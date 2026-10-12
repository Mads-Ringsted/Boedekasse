-- #64: Anke verdict and Ændr afgørelse.
--
-- Any Medlem except the giver and the receiver records the group's verdict.
-- The loser bears the Bøde (`bode_baerer` already follows anke.afgoerelse):
-- a won Anke moves it to the giver at the original price, even when the
-- giver is Udmeldt. The Anke Gebyr always stays. The recorder or an Admin can
-- change the verdict until the next Sæson starts (Pause included).
--
-- 1. public.aktivitet_bode: + afgjort_af, afgjort_af_navn, afgjort, anke_gebyr.
-- 2. public.afgoer_anke.
-- 3. public.aendr_afgoerelse.

-- ---------- 1. aktivitet_bode (from #55) ----------
-- Unchanged, plus four last columns for the Bøde detail sheet:
--   afgjort_af / afgjort_af_navn / afgjort: who recorded (or last changed)
--     the verdict, and when;
--   anke_gebyr: the Anke Gebyr the receiver pays, null when there is none or
--     it was annulled.
create or replace view public.aktivitet_bode with (security_invoker = true) as
select b.id,
       b.bodekasse_id,
       b.saeson_id,
       b.batch_id,
       b.giver_id,
       g.navn                                   as giver_navn,
       b.modtager_id,
       m.navn                                   as modtager_navn,
       b.bodekategori_id,
       coalesce(k.navn, b.grund)                as navn,
       b.grund is not null                      as engangsbode,
       b.pris,
       b.givet,
       b.anke_id,
       b.afgoerelse,
       b.anket,
       coalesce(an.aendret, false)              as afgoerelse_aendret,
       b.baerer_id,
       b.annulleret,
       b.annulleret_af,
       x.navn                                   as annulleret_af_navn,
       b.annulleret_note,
       -- The Engangsbøde Gebyr the giver pays (not annulled); 0 for the rest.
       coalesce((select sum(gb.beloeb) from public.gebyr gb
                  where gb.bode_id = b.id and gb.annulleret is null), 0)::int as gebyr,
       an.afgjort_af,
       af.navn                                  as afgjort_af_navn,
       an.afgjort,
       (select sum(ga.beloeb) from public.gebyr ga
         where ga.anke_id = b.anke_id and ga.annulleret is null)::int        as anke_gebyr
  from public.bode_baerer b
  join public.medlem g on g.id = b.giver_id
  join public.medlem m on m.id = b.modtager_id
  left join public.bodekategori k on k.id = b.bodekategori_id
  left join public.anke an on an.id = b.anke_id
  left join public.medlem x on x.id = b.annulleret_af
  left join public.medlem af on af.id = an.afgjort_af;

-- ---------- shared: write a verdict ----------
-- Sets the verdict on a locked Anke and writes the feed entry. The caller
-- has checked who may do it.
-- Feed: art 'anke_afgjort', aktoer = who decided, modtager = the giver,
--   ref anke (so the receiver, who pays the Anke Gebyr, is involved too),
--   data {bode_id, navn, pris, afgoerelse, aendret, appellant_id,
--   appellant_navn}. The appellant is the Bøde's receiver.
create function private.saet_afgoerelse(
  p_anke public.anke, p_bode public.bode, p_mig uuid,
  p_afgoerelse public.anke_afgoerelse, p_aendret boolean)
returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  update public.anke
     set afgoerelse = p_afgoerelse, afgjort_af = p_mig, afgjort = now(),
         aendret = aendret or p_aendret
   where id = p_anke.id;

  perform private.tilfoej_haendelse(
    p_anke.bodekasse_id, p_mig, 'anke_afgjort',
    jsonb_build_object(
      'bode_id', p_bode.id,
      'navn', coalesce((select navn from public.bodekategori where id = p_bode.bodekategori_id), p_bode.grund),
      'pris', p_bode.pris,
      'afgoerelse', p_afgoerelse,
      'aendret', p_aendret,
      'appellant_id', p_bode.modtager_id,
      'appellant_navn', (select navn from public.medlem where id = p_bode.modtager_id)),
    'anke', p_anke.id, p_modtager => p_bode.giver_id, p_saeson => p_bode.saeson_id);
end $$;

revoke execute on function private.saet_afgoerelse(public.anke, public.bode, uuid, public.anke_afgoerelse, boolean)
  from public, anon, authenticated;

-- ---------- 2. afgoer_anke ----------
-- Any Medlem except the giver and the receiver records the verdict on an
-- open Anke: 'giver_vandt' ("Bøden står ved magt") or 'modtager_vandt'
-- ("Anken vinder"). Works on the latest Sæson until the next one starts,
-- Pause included. Returns {"anke_id": uuid}.
-- Errors, in order: ikke_fundet, ikke_medlem (42501), allerede_annulleret
--   (an open Anke on an annulled Bøde ends as "Bøden annulleret"),
--   tidligere_saeson, part_i_anken (42501), afgoerelse_ugyldig,
--   allerede_afgjort (changing is aendr_afgoerelse).
create function public.afgoer_anke(
  p_klient_id uuid, p_anke uuid, p_afgoerelse public.anke_afgoerelse)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_anke      public.anke;
  v_bode      public.bode;
  v_mig       uuid;
  v_tidligere jsonb;
begin
  -- Lock the Anke so two Medlemmer can't record at once.
  select * into v_anke from public.anke where id = p_anke for update;
  if v_anke.id is null then raise exception 'ikke_fundet'; end if;
  v_mig := private.mit_medlem(v_anke.bodekasse_id);

  v_tidligere := private.start_kald(p_klient_id, 'afgoer_anke');
  if v_tidligere is not null then return v_tidligere; end if;

  select * into v_bode from public.bode where id = v_anke.bode_id;
  if v_bode.annulleret is not null then raise exception 'allerede_annulleret'; end if;
  perform private.tjek_seneste_saeson(v_bode.bodekasse_id, v_bode.saeson_id);
  if v_mig in (v_bode.giver_id, v_bode.modtager_id) then
    raise exception 'part_i_anken' using errcode = '42501';
  end if;
  if p_afgoerelse is null or p_afgoerelse not in ('giver_vandt', 'modtager_vandt') then
    raise exception 'afgoerelse_ugyldig';
  end if;
  if v_anke.afgoerelse is not null then raise exception 'allerede_afgjort'; end if;

  perform private.saet_afgoerelse(v_anke, v_bode, v_mig, p_afgoerelse, false);
  return private.afslut_kald(p_klient_id, jsonb_build_object('anke_id', v_anke.id));
end $$;

revoke execute on function public.afgoer_anke(uuid, uuid, public.anke_afgoerelse) from public, anon;
grant execute on function public.afgoer_anke(uuid, uuid, public.anke_afgoerelse) to authenticated;

-- ---------- 3. aendr_afgoerelse ----------
-- The one who recorded the verdict, or an Admin, flips it to the other
-- verdict. The Anke is then tagged "Afgørelse ændret", and whoever changed it
-- becomes the one who decided. Same Sæson rule as afgoer_anke.
-- Returns {"anke_id": uuid}.
-- Errors, in order: ikke_fundet, ikke_medlem (42501), allerede_annulleret,
--   tidligere_saeson, anke_ikke_afgjort (open, or closed as ikke_afgjort),
--   ikke_tilladt (42501), afgoerelse_ugyldig, samme_afgoerelse.
create function public.aendr_afgoerelse(
  p_klient_id uuid, p_anke uuid, p_afgoerelse public.anke_afgoerelse)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_anke      public.anke;
  v_bode      public.bode;
  v_mig       uuid;
  v_tidligere jsonb;
begin
  select * into v_anke from public.anke where id = p_anke for update;
  if v_anke.id is null then raise exception 'ikke_fundet'; end if;
  v_mig := private.mit_medlem(v_anke.bodekasse_id);

  v_tidligere := private.start_kald(p_klient_id, 'aendr_afgoerelse');
  if v_tidligere is not null then return v_tidligere; end if;

  select * into v_bode from public.bode where id = v_anke.bode_id;
  if v_bode.annulleret is not null then raise exception 'allerede_annulleret'; end if;
  perform private.tjek_seneste_saeson(v_bode.bodekasse_id, v_bode.saeson_id);
  if v_anke.afgoerelse is null or v_anke.afgoerelse = 'ikke_afgjort' then
    raise exception 'anke_ikke_afgjort';
  end if;
  if v_anke.afgjort_af is distinct from v_mig
     and not exists (select 1 from public.medlem where id = v_mig and er_admin) then
    raise exception 'ikke_tilladt' using errcode = '42501';
  end if;
  if p_afgoerelse is null or p_afgoerelse not in ('giver_vandt', 'modtager_vandt') then
    raise exception 'afgoerelse_ugyldig';
  end if;
  if p_afgoerelse = v_anke.afgoerelse then raise exception 'samme_afgoerelse'; end if;

  perform private.saet_afgoerelse(v_anke, v_bode, v_mig, p_afgoerelse, true);
  return private.afslut_kald(p_klient_id, jsonb_build_object('anke_id', v_anke.id));
end $$;

revoke execute on function public.aendr_afgoerelse(uuid, uuid, public.anke_afgoerelse) from public, anon;
grant execute on function public.aendr_afgoerelse(uuid, uuid, public.anke_afgoerelse) to authenticated;
