-- #66: Konkurrencer.
--
-- Any Medlem records a Konkurrence: a title, a date and the finishing order.
-- Every active Medlem (claimed or not) is placed or absent, and each pays a
-- Gebyr at once: a placement Gebyr from the box's table (places past its end
-- pay the last amount; 0 kr is allowed) or the absent Gebyr. Ties share a
-- place and skip the next (1, 2, 2, 4).
--
-- The recorder or an Admin can correct it (needs a running Sæson: it annuls
-- the old Gebyrer with the note "rettet" and charges new ones) or annul it as
-- a whole (works on the latest Sæson until the next starts, Pause included;
-- annuls every Gebyr it charged).
--
-- Reads: konkurrence_resultat_visning (one row per Medlem), konkurrence_visning
-- (one row per Konkurrence, with its result as jsonb), and a new `konkurrence`
-- column on the aktivitet view.

-- ---------- Settings ----------
-- The placement table: a JSON array of 1–20 whole kroner, each 0 or more.
create function private.indstilling_placeringer(p_vaerdi jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
begin
  if jsonb_typeof(p_vaerdi) is distinct from 'array'
     or jsonb_array_length(p_vaerdi) not between 1 and 20
     or exists (select 1 from jsonb_array_elements(p_vaerdi) e
                 where jsonb_typeof(e) <> 'number' or (e #>> '{}')::numeric < 0
                    or (e #>> '{}')::numeric <> trunc((e #>> '{}')::numeric)
                    or (e #>> '{}')::numeric > 100000) then
    raise exception 'indstilling_ugyldig';
  end if;
  return p_vaerdi;
end $$;

insert into private.indstilling (noegle, rens) values
  ('konkurrence_til', null),
  ('placeringer',     'private.indstilling_placeringer'),
  ('fravaersgebyr',   null);

-- ---------- Building blocks ----------

-- A trimmed, required title (titel_mangler).
create function private.konkurrence_titel(p_titel text) returns text
language plpgsql immutable set search_path = '' as $$
declare v_titel text := btrim(coalesce(p_titel, ''));
begin
  if v_titel = '' then raise exception 'titel_mangler'; end if;
  if length(v_titel) > 60 then raise exception 'titel_for_lang'; end if;
  return v_titel;
end $$;

-- Writes a Konkurrence's result and charges its Gebyrer in the running Sæson.
-- p_placeringer is the finishing order as groups: [[a], [b, c], [d]] puts a
-- 1st, b and c 2nd, d 4th. Every other active Medlem is absent.
-- p_tidligere: Medlemmer of the old result (a correction), who may be placed
-- even if they have been Udmeldt since.
-- Errors: konkurrence_ugyldig (bad shape, a Medlem twice), ingen_placeret,
-- deltager_ukendt (not an active Medlem of the box), pause.
create function private.saet_konkurrence_resultat(
  p_bodekasse uuid, p_konkurrence uuid, p_placeringer jsonb, p_tidligere uuid[] default '{}')
returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_kasse  public.bodekasse;
  v_gruppe jsonb;
  v_element jsonb;
  v_id     uuid;
  v_ids    uuid[] := '{}';
  v_plads  int := 1;
  v_antal  int;
begin
  if jsonb_typeof(p_placeringer) is distinct from 'array' then raise exception 'konkurrence_ugyldig'; end if;
  if jsonb_array_length(p_placeringer) = 0 then raise exception 'ingen_placeret'; end if;
  select * into v_kasse from public.bodekasse where id = p_bodekasse;

  for v_gruppe in select value from jsonb_array_elements(p_placeringer) loop
    if jsonb_typeof(v_gruppe) <> 'array' or jsonb_array_length(v_gruppe) = 0 then
      raise exception 'konkurrence_ugyldig';
    end if;
    v_antal := 0;
    for v_element in select value from jsonb_array_elements(v_gruppe) loop
      if jsonb_typeof(v_element) <> 'string'
         or (v_element #>> '{}') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        raise exception 'konkurrence_ugyldig';
      end if;
      v_id := (v_element #>> '{}')::uuid;
      if v_id = any (v_ids) then raise exception 'konkurrence_ugyldig'; end if;
      if not exists (select 1 from public.medlem m
                      where m.id = v_id and m.bodekasse_id = p_bodekasse
                        and (m.udmeldt is null or v_id = any (p_tidligere))) then
        raise exception 'deltager_ukendt';
      end if;
      v_ids := v_ids || v_id;
      insert into public.konkurrence_resultat (bodekasse_id, konkurrence_id, medlem_id, plads)
      values (p_bodekasse, p_konkurrence, v_id, v_plads);
      perform private.opret_gebyr(p_bodekasse, v_id, 'placering',
        v_kasse.placeringer[least(v_plads, cardinality(v_kasse.placeringer))], p_konkurrence);
      v_antal := v_antal + 1;
    end loop;
    v_plads := v_plads + v_antal;
  end loop;

  for v_id in select m.id from public.medlem m
               where m.bodekasse_id = p_bodekasse and m.udmeldt is null and m.id <> all (v_ids) loop
    insert into public.konkurrence_resultat (bodekasse_id, konkurrence_id, medlem_id, plads)
    values (p_bodekasse, p_konkurrence, v_id, null);
    perform private.opret_gebyr(p_bodekasse, v_id, 'fravaer', v_kasse.fravaersgebyr, p_konkurrence);
  end loop;
end $$;

-- Locks a Konkurrence and checks the caller recorded it or is an Admin.
-- Returns the row; rejects an unknown id or another box's (ikke_fundet).
create function private.min_konkurrence(p_konkurrence uuid) returns public.konkurrence
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_k   public.konkurrence;
  v_mig uuid;
begin
  select * into v_k from public.konkurrence where id = p_konkurrence for update;
  if v_k.id is null then raise exception 'ikke_fundet'; end if;
  v_mig := private.mit_medlem(v_k.bodekasse_id);
  if v_k.oprettet_af <> v_mig
     and not exists (select 1 from public.medlem where id = v_mig and er_admin) then
    raise exception 'ikke_tilladt' using errcode = '42501';
  end if;
  return v_k;
end $$;

-- ---------- registrer_konkurrence ----------
-- Any active Medlem, with Konkurrence on and a running Sæson.
-- p_placeringer: see private.saet_konkurrence_resultat. p_dato defaults to
-- today (Copenhagen). Returns {"konkurrence_id": uuid}.
-- Feed: one 'konkurrence_registreret' {titel} entry pointing at the
-- Konkurrence; its Gebyrer show on it.
-- Errors: ikke_medlem (42501), konkurrence_slaaet_fra, pause, titel_mangler,
-- titel_for_lang, plus those of saet_konkurrence_resultat.
create function public.registrer_konkurrence(
  p_klient_id uuid, p_bodekasse uuid, p_titel text, p_dato date, p_placeringer jsonb)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_mig       uuid := private.mit_medlem(p_bodekasse);
  v_tidligere jsonb;
  v_titel     text;
  v_saeson    uuid;
  v_id        uuid;
begin
  v_tidligere := private.start_kald(p_klient_id, 'registrer_konkurrence');
  if v_tidligere is not null then return v_tidligere; end if;

  if not (select konkurrence_til from public.bodekasse where id = p_bodekasse) then
    raise exception 'konkurrence_slaaet_fra';
  end if;
  v_saeson := private.aktiv_saeson(p_bodekasse);
  if v_saeson is null then raise exception 'pause'; end if;
  v_titel := private.konkurrence_titel(p_titel);

  insert into public.konkurrence (bodekasse_id, saeson_id, titel, dato, oprettet_af)
  values (p_bodekasse, v_saeson, v_titel,
          coalesce(p_dato, (now() at time zone 'Europe/Copenhagen')::date), v_mig)
  returning id into v_id;
  perform private.saet_konkurrence_resultat(p_bodekasse, v_id, p_placeringer);

  perform private.tilfoej_haendelse(
    p_bodekasse, v_mig, 'konkurrence_registreret', jsonb_build_object('titel', v_titel),
    'konkurrence', v_id);
  return private.afslut_kald(p_klient_id, jsonb_build_object('konkurrence_id', v_id));
end $$;

revoke execute on function public.registrer_konkurrence(uuid, uuid, text, date, jsonb) from public, anon;
grant execute on function public.registrer_konkurrence(uuid, uuid, text, date, jsonb) to authenticated;

-- ---------- ret_konkurrence ----------
-- The recorder or an Admin; needs a running Sæson, and the Konkurrence must
-- belong to it and not be annulled. Replaces title, date and result: the old
-- Gebyrer are annulled (note "rettet") and new ones charged from the current
-- table. The feed entry stays; it shows "Rettet af X". Returns {}.
-- Errors: ikke_fundet, ikke_medlem / ikke_tilladt (42501), pause,
-- tidligere_saeson, annulleret, plus those of registrer_konkurrence.
create function public.ret_konkurrence(
  p_klient_id uuid, p_konkurrence uuid, p_titel text, p_dato date, p_placeringer jsonb)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_k         public.konkurrence := private.min_konkurrence(p_konkurrence);
  v_mig       uuid := private.mit_medlem(v_k.bodekasse_id);
  v_tidligere jsonb;
  v_titel     text;
  v_saeson    uuid;
  v_deltagere uuid[];
begin
  v_tidligere := private.start_kald(p_klient_id, 'ret_konkurrence');
  if v_tidligere is not null then return v_tidligere; end if;

  if v_k.annulleret is not null then raise exception 'annulleret'; end if;
  v_saeson := private.aktiv_saeson(v_k.bodekasse_id);
  if v_saeson is null then raise exception 'pause'; end if;
  if v_k.saeson_id <> v_saeson then raise exception 'tidligere_saeson'; end if;
  v_titel := private.konkurrence_titel(p_titel);

  v_deltagere := array(select medlem_id from public.konkurrence_resultat where konkurrence_id = v_k.id);
  update public.gebyr
     set annulleret = now(), annulleret_af = v_mig, annulleret_note = 'rettet'
   where konkurrence_id = v_k.id and annulleret is null;
  delete from public.konkurrence_resultat where konkurrence_id = v_k.id;
  perform private.saet_konkurrence_resultat(v_k.bodekasse_id, v_k.id, p_placeringer, v_deltagere);

  update public.konkurrence
     set titel = v_titel, dato = coalesce(p_dato, dato), rettet_af = v_mig, rettet = now()
   where id = v_k.id;
  return private.afslut_kald(p_klient_id, '{}');
end $$;

revoke execute on function public.ret_konkurrence(uuid, uuid, text, date, jsonb) from public, anon;
grant execute on function public.ret_konkurrence(uuid, uuid, text, date, jsonb) to authenticated;

-- ---------- annuller_konkurrence ----------
-- The recorder or an Admin, in the latest Sæson (Pause included). Annuls the
-- Konkurrence and every Gebyr it charged, with the optional note. The old
-- entry stays, struck through; a new 'konkurrence_annulleret'
-- {titel, beloeb, konkurrence_id} entry appears at the top (no ref, so it is
-- not struck itself). Returns {}.
-- Errors: ikke_fundet, ikke_medlem / ikke_tilladt (42501), tidligere_saeson,
-- annulleret.
create function public.annuller_konkurrence(p_klient_id uuid, p_konkurrence uuid, p_note text default null)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_k         public.konkurrence := private.min_konkurrence(p_konkurrence);
  v_mig       uuid := private.mit_medlem(v_k.bodekasse_id);
  v_tidligere jsonb;
  v_note      text := nullif(btrim(coalesce(p_note, '')), '');
  v_beloeb    int;
begin
  v_tidligere := private.start_kald(p_klient_id, 'annuller_konkurrence');
  if v_tidligere is not null then return v_tidligere; end if;

  if v_k.annulleret is not null then raise exception 'annulleret'; end if;
  if v_k.saeson_id <> private.seneste_saeson(v_k.bodekasse_id) then raise exception 'tidligere_saeson'; end if;

  select coalesce(sum(beloeb), 0) into v_beloeb
    from public.gebyr where konkurrence_id = v_k.id and annulleret is null;
  update public.gebyr
     set annulleret = now(), annulleret_af = v_mig, annulleret_note = v_note
   where konkurrence_id = v_k.id and annulleret is null;
  update public.konkurrence
     set annulleret = now(), annulleret_af = v_mig, annulleret_note = v_note
   where id = v_k.id;

  perform private.tilfoej_haendelse(
    v_k.bodekasse_id, v_mig, 'konkurrence_annulleret',
    jsonb_build_object('titel', v_k.titel, 'beloeb', v_beloeb, 'konkurrence_id', v_k.id),
    null, null, null, null, v_k.saeson_id);
  return private.afslut_kald(p_klient_id, '{}');
end $$;

revoke execute on function public.annuller_konkurrence(uuid, uuid, text) from public, anon;
grant execute on function public.annuller_konkurrence(uuid, uuid, text) to authenticated;

-- ---------- Read views ----------

-- One row per Medlem in a Konkurrence's current result, with the Gebyr they
-- pay for it (the latest one: after an annulment, the annulled amount).
create view public.konkurrence_resultat_visning with (security_invoker = true) as
select r.konkurrence_id,
       r.bodekasse_id,
       r.medlem_id,
       m.navn                   as medlem_navn,
       m.user_id is not null    as logget_ind,
       r.plads,
       g.beloeb
  from public.konkurrence_resultat r
  join public.medlem m on m.id = r.medlem_id
  left join lateral (
    select gb.beloeb from public.gebyr gb
     where gb.konkurrence_id = r.konkurrence_id and gb.medlem_id = r.medlem_id
     order by gb.annulleret is null desc, gb.oprettet desc, gb.id
     limit 1
  ) g on true;

-- One row per Konkurrence: what the list, the result screen and the feed row
-- show. `resultat` is [{medlem_id, navn, logget_ind, plads, beloeb}], placed
-- first by place, then the absent, A–Å. `total` and `antal_gebyrer` count the
-- current Gebyrer (the annulled ones on an annulled Konkurrence).
create view public.konkurrence_visning with (security_invoker = true) as
select k.id,
       k.bodekasse_id,
       k.saeson_id,
       k.titel,
       k.dato,
       k.oprettet_af,
       o.navn                as oprettet_af_navn,
       k.oprettet,
       k.rettet_af,
       rt.navn               as rettet_af_navn,
       k.rettet,
       k.annulleret,
       k.annulleret_af,
       x.navn                as annulleret_af_navn,
       k.annulleret_note,
       coalesce(s.antal_placeret, 0)    as antal_placeret,
       coalesce(s.antal_fravaerende, 0) as antal_fravaerende,
       coalesce(s.antal_gebyrer, 0)     as antal_gebyrer,
       coalesce(s.total, 0)             as total,
       coalesce(s.resultat, '[]')       as resultat
  from public.konkurrence k
  join public.medlem o on o.id = k.oprettet_af
  left join public.medlem rt on rt.id = k.rettet_af
  left join public.medlem x on x.id = k.annulleret_af
  left join lateral (
    select count(*) filter (where rv.plads is not null)::int as antal_placeret,
           count(*) filter (where rv.plads is null)::int     as antal_fravaerende,
           count(rv.beloeb)::int                             as antal_gebyrer,
           coalesce(sum(rv.beloeb), 0)::int                  as total,
           jsonb_agg(jsonb_build_object(
             'medlem_id', rv.medlem_id, 'navn', rv.medlem_navn, 'logget_ind', rv.logget_ind,
             'plads', rv.plads, 'beloeb', rv.beloeb)
             order by rv.plads nulls last, rv.medlem_navn, rv.medlem_id) as resultat
      from public.konkurrence_resultat_visning rv
     where rv.konkurrence_id = k.id
  ) s on true;

grant select on public.konkurrence_resultat_visning, public.konkurrence_visning to authenticated;

-- ---------- aktivitet (from #55) + the Konkurrence ----------
-- Unchanged, plus a last column `konkurrence`: the konkurrence_visning row as
-- jsonb for an entry about a Konkurrence (ref_tabel 'konkurrence'), else null.
create or replace view public.aktivitet with (security_invoker = true) as
select h.id,
       h.bodekasse_id,
       h.saeson_id,
       h.tid,
       h.art,
       h.aktoer_id,
       a.navn        as aktoer_navn,
       h.modtager_id,
       m.navn        as modtager_navn,
       h.batch_id,
       h.ref_tabel,
       h.ref_id,
       h.data,
       r.annulleret,
       r.annulleret_af,
       x.navn        as annulleret_af_navn,
       r.annulleret_note,
       bo.boeder,
       ge.gebyrer,
       array_remove(array[h.aktoer_id, h.modtager_id], null)
         || coalesce(ge.betalere, '{}')                  as involverede,
       (select to_jsonb(kv) from public.konkurrence_visning kv
         where h.ref_tabel = 'konkurrence' and kv.id = h.ref_id) as konkurrence
  from public.haendelse h
  left join public.medlem a on a.id = h.aktoer_id
  left join public.medlem m on m.id = h.modtager_id
  -- The annullable row the entry is about (ref_tabel/ref_id), if any. An
  -- entry ABOUT an annulment must not point here, or it shows struck too.
  left join lateral (
              select t.annulleret, t.annulleret_af, t.annulleret_note from public.bode t
               where h.ref_tabel = 'bode' and t.id = h.ref_id
    union all select t.annulleret, t.annulleret_af, t.annulleret_note from public.gebyr t
               where h.ref_tabel = 'gebyr' and t.id = h.ref_id
    union all select t.annulleret, t.annulleret_af, t.annulleret_note from public.indbetaling t
               where h.ref_tabel = 'indbetaling' and t.id = h.ref_id
    union all select t.annulleret, t.annulleret_af, t.annulleret_note from public.haevning t
               where h.ref_tabel = 'haevning' and t.id = h.ref_id
    union all select t.annulleret, t.annulleret_af, t.annulleret_note from public.frikob t
               where h.ref_tabel = 'frikob' and t.id = h.ref_id
    union all select t.annulleret, t.annulleret_af, t.annulleret_note from public.konkurrence t
               where h.ref_tabel = 'konkurrence' and t.id = h.ref_id
  ) r on true
  left join public.medlem x on x.id = r.annulleret_af
  -- A Giv batch row: this receiver's Bøder in the batch, oldest first.
  left join lateral (
    select jsonb_agg(to_jsonb(ab) order by ab.givet, ab.navn, ab.id) as boeder
      from public.aktivitet_bode ab
     where h.batch_id is not null and ab.batch_id = h.batch_id and ab.modtager_id = h.modtager_id
  ) bo on true
  -- The Gebyrer the entry's cause charged (annulled ones too, marked), so a
  -- Gebyr sits on its cause's row. A Bødekategori's creation Gebyr shows on
  -- its created row only; an Engangsbøde's Gebyr is in `boeder` instead.
  left join lateral (
    select jsonb_agg(jsonb_build_object(
             'id', g.id, 'art', g.art, 'beloeb', g.beloeb,
             'medlem_id', g.medlem_id, 'medlem_navn', gm.navn,
             'annulleret', g.annulleret, 'annulleret_af', g.annulleret_af,
             'annulleret_af_navn', gx.navn, 'annulleret_note', g.annulleret_note)
             order by g.oprettet, g.id)        as gebyrer,
           array_agg(distinct g.medlem_id)     as betalere
      from public.gebyr g
      join public.medlem gm on gm.id = g.medlem_id
      left join public.medlem gx on gx.id = g.annulleret_af
     where case h.ref_tabel
             when 'bodekategori' then h.art = 'bodekategori_oprettet' and g.art = 'oprettelse'
                                      and g.bodekategori_id = h.ref_id
             when 'anke'         then g.anke_id = h.ref_id
             when 'frikob'       then g.frikob_id = h.ref_id
             when 'konkurrence'  then g.konkurrence_id = h.ref_id
             else false
           end
  ) ge on true;
