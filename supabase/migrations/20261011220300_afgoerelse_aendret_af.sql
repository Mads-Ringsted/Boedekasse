-- Review fix: changing a verdict keeps the original recorder.
--
-- aendr_afgoerelse used to overwrite anke.afgjort_af, so the Medlem who
-- recorded the verdict lost the right to change it. Now afgjort_af/afgjort
-- stay the original recording, and the new anke.aendret_af/aendret_tid hold
-- who last changed it and when. The recorder or an Admin may still change it.

alter table public.anke
  add column aendret_af  uuid,
  add column aendret_tid timestamptz,
  add foreign key (bodekasse_id, aendret_af) references public.medlem (bodekasse_id, id);

-- ---------- aktivitet_bode (from 20261011213000_anke_afgoerelse.sql) ----------
-- Unchanged, plus three last columns: aendret_af / aendret_af_navn /
-- aendret_tid = who last changed the verdict, and when (null if never).
-- afgjort_af / afgjort_af_navn / afgjort are now always the original recording.
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
         where ga.anke_id = b.anke_id and ga.annulleret is null)::int        as anke_gebyr,
       an.aendret_af,
       ae.navn                                  as aendret_af_navn,
       an.aendret_tid
  from public.bode_baerer b
  join public.medlem g on g.id = b.giver_id
  join public.medlem m on m.id = b.modtager_id
  left join public.bodekategori k on k.id = b.bodekategori_id
  left join public.anke an on an.id = b.anke_id
  left join public.medlem x on x.id = b.annulleret_af
  left join public.medlem af on af.id = an.afgjort_af
  left join public.medlem ae on ae.id = an.aendret_af;

-- ---------- saet_afgoerelse (from 20261011213000_anke_afgoerelse.sql) ----------
-- A first verdict sets afgjort_af/afgjort; a change sets aendret_af/aendret_tid.
create or replace function private.saet_afgoerelse(
  p_anke public.anke, p_bode public.bode, p_mig uuid,
  p_afgoerelse public.anke_afgoerelse, p_aendret boolean)
returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  if p_aendret then
    update public.anke
       set afgoerelse = p_afgoerelse, aendret = true, aendret_af = p_mig, aendret_tid = now()
     where id = p_anke.id;
  else
    update public.anke
       set afgoerelse = p_afgoerelse, afgjort_af = p_mig, afgjort = now()
     where id = p_anke.id;
  end if;

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
