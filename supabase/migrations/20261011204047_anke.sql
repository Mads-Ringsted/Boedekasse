-- #63: Anke, file and spin the wheel.
--
-- The receiver of a Bøde appeals it within the box's window. The server draws
-- the Anke Gebyr; the client only animates a wheel to the amount. The Bøde
-- then counts for nobody until a verdict (#64): `bode_baerer` already does
-- that for a pending Anke, so no view changes here.
--
-- 1. Settings: anke_til, anke_vindue_timer, anke_min, anke_max_gange go
--    through opdater_indstillinger (the columns' checks guard them).
-- 2. public.indgiv_anke.

-- ---------- 1. Settings ----------
insert into private.indstilling (noegle) values
  ('anke_til'), ('anke_vindue_timer'), ('anke_min'), ('anke_max_gange');

-- ---------- 2. indgiv_anke ----------
-- The receiver files an Anke on a Bøde. Rules, by the box's settings at the
-- moment of filing:
--   - the rule is on (anke_slaaet_fra);
--   - the caller is the receiver (ikke_modtager, 42501);
--   - within anke_vindue_timer hours of `givet` (anke_frist_udloebet);
--   - once per Bøde, ever, whatever happened to an earlier Anke (anke_findes);
--   - a Sæson runs (pause) and the Bøde is from it (tidligere_saeson);
--   - not annulled (allerede_annulleret).
-- A Bøde moved by a won Anke can't be appealed again (it already has its
-- Anke), and Gebyrer are not Bøder, so neither can be appealed.
-- The Gebyr is a whole-krone amount drawn uniformly from
--   [anke_min, greatest(anke_min, floor(anke_max_gange × kept price))].
-- The receiver pays it at once (art 'anke'), whatever the verdict. It can't
-- be withdrawn.
-- Returns {"anke_id": uuid, "gebyr": int, "min": int, "max": int}; min/max
-- are the range it was drawn from (the wheel shows "af 1–100 kr").
-- Feed: art 'anke_indgivet', aktoer = the receiver, modtager = the giver,
--   ref anke (so the Gebyr shows on it through `aktivitet.gebyrer`),
--   data {bode_id, navn: Bødekategori name or Engangsbøde reason, pris}.
create function public.indgiv_anke(p_klient_id uuid, p_bode uuid)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_bode      public.bode;
  v_kasse     public.bodekasse;
  v_mig       uuid;
  v_saeson    uuid;
  v_min       int;
  v_max       int;
  v_gebyr     int;
  v_anke      uuid;
  v_tidligere jsonb;
begin
  -- Lock the Bøde so an annulment or a second Anke can't slip in between.
  select * into v_bode from public.bode where id = p_bode for update;
  if v_bode.id is null then raise exception 'ikke_fundet'; end if;
  v_mig := private.mit_medlem(v_bode.bodekasse_id);

  v_tidligere := private.start_kald(p_klient_id, 'indgiv_anke');
  if v_tidligere is not null then return v_tidligere; end if;

  if v_bode.modtager_id <> v_mig then
    raise exception 'ikke_modtager' using errcode = '42501';
  end if;

  select * into v_kasse from public.bodekasse where id = v_bode.bodekasse_id;
  if not v_kasse.anke_til then raise exception 'anke_slaaet_fra'; end if;

  v_saeson := private.aktiv_saeson(v_bode.bodekasse_id);
  if v_saeson is null then raise exception 'pause'; end if;
  if v_bode.saeson_id <> v_saeson then raise exception 'tidligere_saeson'; end if;
  if v_bode.annulleret is not null then raise exception 'allerede_annulleret'; end if;
  if exists (select 1 from public.anke where bode_id = v_bode.id) then
    raise exception 'anke_findes';
  end if;
  if now() >= v_bode.givet + make_interval(hours => v_kasse.anke_vindue_timer) then
    raise exception 'anke_frist_udloebet';
  end if;

  v_min := v_kasse.anke_min;
  v_max := greatest(v_min, floor(v_kasse.anke_max_gange * v_bode.pris)::int);
  v_gebyr := v_min + floor(random() * (v_max - v_min + 1))::int;

  begin
    insert into public.anke (bodekasse_id, saeson_id, bode_id)
    values (v_bode.bodekasse_id, v_saeson, v_bode.id)
    returning id into v_anke;
  exception when unique_violation then
    raise exception 'anke_findes';
  end;

  perform private.opret_gebyr(v_bode.bodekasse_id, v_mig, 'anke', v_gebyr, v_anke);
  perform private.tilfoej_haendelse(
    v_bode.bodekasse_id, v_mig, 'anke_indgivet',
    jsonb_build_object(
      'bode_id', v_bode.id,
      'navn', coalesce((select navn from public.bodekategori where id = v_bode.bodekategori_id), v_bode.grund),
      'pris', v_bode.pris),
    'anke', v_anke, p_modtager => v_bode.giver_id, p_saeson => v_saeson);

  return private.afslut_kald(p_klient_id, jsonb_build_object(
    'anke_id', v_anke, 'gebyr', v_gebyr, 'min', v_min, 'max', v_max));
end $$;

revoke execute on function public.indgiv_anke(uuid, uuid) from public, anon;
grant execute on function public.indgiv_anke(uuid, uuid) to authenticated;
