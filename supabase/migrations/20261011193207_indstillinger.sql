-- #57: Indstillinger and the creation Gebyr.
--
-- 1. opdater_indstillinger: an Admin changes some of the box's settings (the
--    settings are columns on public.bodekasse). Only the keys sent change, so
--    two Admins editing different rows never undo each other. A change never
--    charges or refunds anything already done, and adds no feed entry.
--    Which columns it may change is DATA, not code: a row per key in
--    private.indstilling. A later ticket that adds a rule just inserts its
--    rows (see "Adding a setting" below); it never redefines the RPC.
-- 2. private.opret_gebyr: the one way to charge a Gebyr (all six kinds).
-- 3. opret_bodekategori charges the creation Gebyr when the rule is on and a
--    Sæson runs (never in a Pause), in the same transaction.

-- ---------- Settings that opdater_indstillinger may change ----------
-- noegle: a column of public.bodekasse (the jsonb key the client sends).
-- rens:   optional private function (jsonb) returns jsonb. It gets the value
--         as sent and returns the value to store, or raises its own error key.
--         Without one, the value is cast to the column type, and the column's
--         check constraints guard it (any failure → indstilling_ugyldig).
--
-- Adding a setting (later tickets), in your own migration:
--   insert into private.indstilling (noegle) values ('frikob_til'), ('frikob_pris');
-- or with a cleaner:
--   create function private.indstilling_x(p jsonb) returns jsonb ... ;
--   insert into private.indstilling (noegle, rens) values ('x', 'private.indstilling_x');
create table private.indstilling (
  noegle text primary key,
  rens   regproc
);

-- The box name: trimmed, required (navn_mangler, as in opret_bodekasse).
create function private.indstilling_navn(p_vaerdi jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare v_navn text;
begin
  if p_vaerdi is null or jsonb_typeof(p_vaerdi) = 'null' then raise exception 'navn_mangler'; end if;
  if jsonb_typeof(p_vaerdi) <> 'string' then raise exception 'indstilling_ugyldig'; end if;
  v_navn := btrim(p_vaerdi #>> '{}');
  if v_navn = '' then raise exception 'navn_mangler'; end if;
  return to_jsonb(v_navn);
end $$;

-- The MobilePay Box number: optional. Trimmed with single spaces, digits and
-- spaces only, at most 20 characters. Empty or null removes it.
create function private.indstilling_mobilepay(p_vaerdi jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare v_nr text;
begin
  if p_vaerdi is null or jsonb_typeof(p_vaerdi) = 'null' then return 'null'; end if;
  if jsonb_typeof(p_vaerdi) <> 'string' then raise exception 'mobilepay_ugyldig'; end if;
  v_nr := regexp_replace(btrim(p_vaerdi #>> '{}'), '\s+', ' ', 'g');
  if v_nr = '' then return 'null'; end if;
  if v_nr !~ '^[0-9]+( [0-9]+)*$' or length(v_nr) > 20 then raise exception 'mobilepay_ugyldig'; end if;
  return to_jsonb(v_nr);
end $$;

insert into private.indstilling (noegle, rens) values
  ('navn',                 'private.indstilling_navn'),
  ('mobilepay_box',        'private.indstilling_mobilepay'),
  ('oprettelsesgebyr_til', null),
  ('oprettelsesgebyr',     null);

-- ---------- opdater_indstillinger ----------
-- Admin only. p_aendringer is a jsonb object {column: new value}, e.g.
--   {"oprettelsesgebyr_til": true, "oprettelsesgebyr": 30}
-- Returns {}. Errors: ikke_medlem / ikke_admin (42501), indstilling_ukendt
-- (a key that isn't a setting), indstilling_ugyldig (wrong type, null, or a
-- check fails, e.g. an amount of 0), plus each cleaner's own keys
-- (navn_mangler, mobilepay_ugyldig). All or nothing.
create function public.opdater_indstillinger(p_klient_id uuid, p_bodekasse uuid, p_aendringer jsonb)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_tidligere jsonb;
  v_ren       jsonb := '{}';
  v_noegle    text;
  v_vaerdi    jsonb;
  v_rens      regproc;
  v_kolonner  text;
begin
  perform private.mit_admin(p_bodekasse);
  v_tidligere := private.start_kald(p_klient_id, 'opdater_indstillinger');
  if v_tidligere is not null then return v_tidligere; end if;

  if jsonb_typeof(p_aendringer) is distinct from 'object' then
    raise exception 'indstilling_ugyldig';
  end if;

  for v_noegle, v_vaerdi in select key, value from jsonb_each(p_aendringer) loop
    select i.rens into v_rens from private.indstilling i where i.noegle = v_noegle;
    if not found then raise exception 'indstilling_ukendt'; end if;
    if v_rens is not null then
      execute format('select %s($1)', v_rens) using v_vaerdi into v_vaerdi;
    end if;
    v_ren := v_ren || jsonb_build_object(v_noegle, v_vaerdi);
  end loop;

  if v_ren <> '{}' then
    select string_agg(format('%I', k), ', ') into v_kolonner from jsonb_object_keys(v_ren) k;
    begin
      execute format(
        'update public.bodekasse set (%1$s) = (select %1$s from jsonb_populate_record(null::public.bodekasse, $1)) where id = $2',
        v_kolonner)
      using v_ren, p_bodekasse;
    exception when data_exception or check_violation or not_null_violation then
      raise exception 'indstilling_ugyldig';
    end;
  end if;

  return private.afslut_kald(p_klient_id, '{}');
end $$;

revoke execute on function public.opdater_indstillinger(uuid, uuid, jsonb) from public, anon;
grant execute on function public.opdater_indstillinger(uuid, uuid, jsonb) to authenticated;

-- ---------- private.opret_gebyr ----------
-- Charges p_medlem a Gebyr in the running Sæson and returns its id.
-- p_aarsag is the cause's id; it goes in the column that matches p_art:
--   oprettelse → bodekategori_id, engangsbode → bode_id, anke → anke_id,
--   frikob → frikob_id, placering / fravaer → konkurrence_id.
-- Raises `pause` when no Sæson runs (callers that skip the Gebyr in a Pause
-- check private.aktiv_saeson first). The Gebyr counts in Saldo and Bøder i
-- alt through the views at once.
-- Feed pattern: a Gebyr has no feed entry of its own. It shows on its
-- cause's entry: the `aktivitet` view (#55) finds it through the entry's
-- ref_tabel/ref_id, so nothing about the Gebyr goes in the entry's data.
create function private.opret_gebyr(
  p_bodekasse uuid, p_medlem uuid, p_art public.gebyr_art, p_beloeb int, p_aarsag uuid)
returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_saeson uuid := private.aktiv_saeson(p_bodekasse);
  v_id     uuid;
begin
  if v_saeson is null then raise exception 'pause'; end if;
  insert into public.gebyr (bodekasse_id, saeson_id, medlem_id, art, beloeb,
                            bodekategori_id, bode_id, anke_id, frikob_id, konkurrence_id)
  values (p_bodekasse, v_saeson, p_medlem, p_art, p_beloeb,
          case when p_art = 'oprettelse'  then p_aarsag end,
          case when p_art = 'engangsbode' then p_aarsag end,
          case when p_art = 'anke'        then p_aarsag end,
          case when p_art = 'frikob'      then p_aarsag end,
          case when p_art in ('placering', 'fravaer') then p_aarsag end)
  returning id into v_id;
  return v_id;
end $$;

-- ---------- opret_bodekategori (from #52) + the creation Gebyr ----------
-- As before, plus: when the box has the creation Gebyr on and a Sæson runs,
-- the creator pays it in the same transaction. The feed entry is unchanged
-- ({navn, pris}); `aktivitet.gebyrer` shows the Gebyr on it.
create or replace function public.opret_bodekategori(
  p_klient_id uuid, p_bodekasse uuid, p_navn text, p_pris int, p_beskrivelse text default null)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_mig       uuid := private.mit_medlem(p_bodekasse);
  v_tidligere jsonb;
  v_navn      text;
  v_id        uuid;
  v_kasse     public.bodekasse;
begin
  v_tidligere := private.start_kald(p_klient_id, 'opret_bodekategori');
  if v_tidligere is not null then return v_tidligere; end if;

  v_navn := private.bodekategori_navn(p_navn);
  perform private.tjek_pris(p_pris);
  perform private.tjek_ledigt_navn(p_bodekasse, v_navn);

  begin
    insert into public.bodekategori (bodekasse_id, navn, pris, beskrivelse, oprettet_af)
    values (p_bodekasse, v_navn, p_pris, nullif(btrim(p_beskrivelse), ''), v_mig)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'navn_findes';   -- someone took the name a moment ago
  end;

  select * into v_kasse from public.bodekasse where id = p_bodekasse;
  if v_kasse.oprettelsesgebyr_til and private.aktiv_saeson(p_bodekasse) is not null then
    perform private.opret_gebyr(p_bodekasse, v_mig, 'oprettelse', v_kasse.oprettelsesgebyr, v_id);
  end if;

  perform private.tilfoej_haendelse(
    p_bodekasse, v_mig, 'bodekategori_oprettet',
    jsonb_build_object('navn', v_navn, 'pris', p_pris),
    'bodekategori', v_id);
  return private.afslut_kald(p_klient_id, jsonb_build_object('bodekategori_id', v_id));
end $$;
