-- #62: Annullér Bøder and Gebyrer.
--
-- public.annuller_bode: the giver annuls their own un-appealed Bøde; an Admin
--   annuls any Bøde. An Engangsbøde's Gebyr goes with it.
-- public.annuller_gebyr: an Admin annuls a single creation or Anke Gebyr.
-- Both check the Sæson with #59's private.tjek_seneste_saeson.
-- Written with `create or replace` so the file can be re-applied by hand.

-- ---------- Annullér bøde ----------

-- Annul a Bøde, with an optional note. The giver may annul their own Bøde
-- while it has never been appealed; an Admin may annul any Bøde. The row stays
-- (annulleret_*) but nobody bears it any more, so it leaves Saldo, Bøder i
-- alt, use counts, top 5 and Topliste. An Engangsbøde's Gebyr is annulled with
-- it (same who and note); an Anke Gebyr always stays. An open Anke is left as
-- it is: the Bøde no longer counts as anket (bode_baerer), and #63 shows it as
-- "Bøden annulleret". Works on the latest Sæson until the next starts (Pause
-- included). Can't be reversed or done twice. Returns {"bode_id": uuid}.
-- Errors: ikke_medlem (42501), ikke_fundet, ikke_tilladt (42501), anket,
--   allerede_annulleret, tidligere_saeson.
-- Feed: art 'bode_annulleret', aktoer = who annulled, modtager = the receiver,
--   NO ref (so this entry isn't struck through itself; the Giv entry is, via
--   aktivitet.boeder), data {bode_id, giver_id, giver_navn, navn, pris,
--   engangsbode, gebyr, note}; gebyr = the Engangsbøde Gebyr annulled with it.

create or replace function public.annuller_bode(
  p_klient_id uuid, p_bode uuid, p_note text default null)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_note      text := nullif(btrim(p_note), '');
  v_bode      public.bode;
  v_mig       uuid;
  v_admin     boolean;
  v_gebyr     int;
  v_tidligere jsonb;
begin
  v_tidligere := private.start_kald(p_klient_id, 'annuller_bode');
  if v_tidligere is not null then return v_tidligere; end if;

  select * into v_bode from public.bode where id = p_bode for update;
  if v_bode.id is null then raise exception 'ikke_fundet'; end if;
  v_mig := private.mit_medlem(v_bode.bodekasse_id);
  select er_admin into v_admin from public.medlem where id = v_mig;
  if not v_admin then
    if v_bode.giver_id is distinct from v_mig then
      raise exception 'ikke_tilladt' using errcode = '42501';
    end if;
    if exists (select 1 from public.anke where bode_id = v_bode.id) then
      raise exception 'anket';
    end if;
  end if;
  if v_bode.annulleret is not null then raise exception 'allerede_annulleret'; end if;
  perform private.tjek_seneste_saeson(v_bode.bodekasse_id, v_bode.saeson_id);

  update public.bode
     set annulleret = now(), annulleret_af = v_mig, annulleret_note = v_note
   where id = v_bode.id;

  with annulleret as (
    update public.gebyr
       set annulleret = now(), annulleret_af = v_mig, annulleret_note = v_note
     where bode_id = v_bode.id and art = 'engangsbode' and annulleret is null
    returning beloeb
  )
  select coalesce(sum(beloeb), 0)::int into v_gebyr from annulleret;

  perform private.tilfoej_haendelse(
    v_bode.bodekasse_id, v_mig, 'bode_annulleret',
    jsonb_build_object(
      'bode_id', v_bode.id,
      'giver_id', v_bode.giver_id,
      'giver_navn', (select navn from public.medlem where id = v_bode.giver_id),
      'navn', coalesce((select navn from public.bodekategori where id = v_bode.bodekategori_id), v_bode.grund),
      'pris', v_bode.pris,
      'engangsbode', v_bode.bodekategori_id is null,
      'gebyr', v_gebyr,
      'note', v_note),
    p_modtager => v_bode.modtager_id, p_saeson => v_bode.saeson_id);

  return private.afslut_kald(p_klient_id, jsonb_build_object('bode_id', v_bode.id));
end $$;

revoke execute on function public.annuller_bode(uuid, uuid, text) from public, anon;
grant execute on function public.annuller_bode(uuid, uuid, text) to authenticated;

-- ---------- Annullér gebyr ----------

-- An Admin annuls a single creation Gebyr ('oprettelse') or Anke Gebyr
-- ('anke'), with an optional note. The other kinds go with their cause: an
-- Engangsbøde Gebyr with its Bøde (annuller_bode), a Frikøbsgebyr with its
-- Frikøb, Konkurrence Gebyrer with the Konkurrence. The row stays but leaves
-- Saldo and Bøder i alt. Latest Sæson only (Pause included); once; can't be
-- reversed. Returns {"gebyr_id": uuid}.
-- Errors: ikke_medlem / ikke_admin (42501), ikke_fundet, kan_ikke_annulleres,
--   allerede_annulleret, tidligere_saeson.
-- Feed: art 'gebyr_annulleret', aktoer = the Admin, modtager = who paid, NO
--   ref, data {gebyr_id, art, navn, beloeb, note}; navn = the Bødekategori
--   created, or the appealed Bøde's name.
create or replace function public.annuller_gebyr(
  p_klient_id uuid, p_gebyr uuid, p_note text default null)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_note      text := nullif(btrim(p_note), '');
  v_gebyr     public.gebyr;
  v_mig       uuid;
  v_navn      text;
  v_tidligere jsonb;
begin
  v_tidligere := private.start_kald(p_klient_id, 'annuller_gebyr');
  if v_tidligere is not null then return v_tidligere; end if;

  select * into v_gebyr from public.gebyr where id = p_gebyr for update;
  if v_gebyr.id is null then raise exception 'ikke_fundet'; end if;
  v_mig := private.mit_admin(v_gebyr.bodekasse_id);
  if v_gebyr.art not in ('oprettelse', 'anke') then raise exception 'kan_ikke_annulleres'; end if;
  if v_gebyr.annulleret is not null then raise exception 'allerede_annulleret'; end if;
  perform private.tjek_seneste_saeson(v_gebyr.bodekasse_id, v_gebyr.saeson_id);

  update public.gebyr
     set annulleret = now(), annulleret_af = v_mig, annulleret_note = v_note
   where id = v_gebyr.id;

  if v_gebyr.art = 'oprettelse' then
    select navn into v_navn from public.bodekategori where id = v_gebyr.bodekategori_id;
  else
    select coalesce(k.navn, b.grund) into v_navn
      from public.anke a
      join public.bode b on b.id = a.bode_id
      left join public.bodekategori k on k.id = b.bodekategori_id
     where a.id = v_gebyr.anke_id;
  end if;

  perform private.tilfoej_haendelse(
    v_gebyr.bodekasse_id, v_mig, 'gebyr_annulleret',
    jsonb_build_object('gebyr_id', v_gebyr.id, 'art', v_gebyr.art, 'navn', v_navn,
                       'beloeb', v_gebyr.beloeb, 'note', v_note),
    p_modtager => v_gebyr.medlem_id, p_saeson => v_gebyr.saeson_id);

  return private.afslut_kald(p_klient_id, jsonb_build_object('gebyr_id', v_gebyr.id));
end $$;

revoke execute on function public.annuller_gebyr(uuid, uuid, text) from public, anon;
grant execute on function public.annuller_gebyr(uuid, uuid, text) to authenticated;
