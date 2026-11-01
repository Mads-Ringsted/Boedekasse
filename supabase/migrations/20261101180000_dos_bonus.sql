-- #77: Dos-bonus, an automatic Gebyr for receiving two Bøder from the same
-- Bødekategori on the same Dos-bonus day.
--
-- 1. Settings on public.bodekasse: dos_bonus_til (off) and dos_bonus_beloeb
--    (10 kr), registered in private.indstilling.
-- 2. public.gebyr: the Dos-bonus day in #78's udloeser plus dos_nr, unique
--    per Medlem, day and sequence number (annulled rows included), and
--    dos_batch_id (the Giv batch that charged it, for Fortryd).
-- 3. private.genberegn_dos_bonus: the recompute for one Medlem and one day.
-- 4. Every RPC that changes which Bøder a Medlem bears on a day calls it:
--    giv_boeder, annuller_bode, private.saet_afgoerelse (afgoer_anke and
--    aendr_afgoerelse) and fortryd_batch. Each is copied from its latest
--    definition (named above it) with the Dos-bonus lines added.
--
-- How a day is counted. A Dos-bonus day runs from 06:00 to 06:00
-- Europe/Copenhagen, keyed on bode.givet. A Bøde counts for the Medlem who
-- bears it: the receiver, or the giver after a won Anke. A Bøde with an open
-- Anke still counts for its receiver: filing an Anke changes nothing here,
-- only the verdict does. Annulled Bøder, Engangsbøder and Gebyrer never count.
--   level0 = Σ floor(nₖ / 2) over the day's Bødekategorier,
--   levelᵢ₊₁ = floor(levelᵢ / 2) until 0; the target is the sum of the levels.
-- Missing Dos-bonuses are created (only when the rule is on, a Sæson runs and
-- the Medlem is active); surplus ones are annulled by whoever made the
-- change, newest first. Nothing is deleted, except by Fortryd.
--
-- Feed: one entry per Dos-bonus, art 'dos_bonus', no aktoer (the box itself),
-- modtager = who pays, ref gebyr (so an annulled one shows struck through),
-- data {dag: 'YYYY-MM-DD', beloeb, kategorier: [the day's paired Bødekategori
-- names]}.

-- ---------- 1. Settings ----------
alter table public.bodekasse
  add column dos_bonus_til    boolean not null default false,
  add column dos_bonus_beloeb int     not null default 10 check (dos_bonus_beloeb > 0);

insert into private.indstilling (noegle) values ('dos_bonus_til'), ('dos_bonus_beloeb');

-- ---------- 2. The Gebyr's trigger ----------
-- Builds on #78 (20261101170100_automatik_catch_up.sql): gebyr.udloeser is
-- the Dos-bonus day, gebyr_aarsag_check already lets the automatic kinds
-- through, and each kind adds its own named check and unique index.
-- dos_nr: the sequence number within the Medlem's day (a day can have
-- several). dos_batch_id: the Giv batch that charged it, so Fortryd can
-- take it back.
alter table public.gebyr
  add column dos_nr       int check (dos_nr > 0),
  add column dos_batch_id uuid;

alter table public.gebyr add constraint gebyr_dos_bonus_check check (
  case when art = 'dos_bonus'
       then udloeser is not null and dos_nr is not null
            and num_nonnulls(bodekategori_id, bode_id, anke_id, frikob_id, konkurrence_id) = 0
       else dos_nr is null and dos_batch_id is null
  end);

-- Unique per Medlem, day and sequence number, annulled rows included.
create unique index gebyr_dos_bonus_unik
  on public.gebyr (medlem_id, udloeser, dos_nr) where art = 'dos_bonus';

-- ---------- 3. The recompute ----------

-- The Dos-bonus day a moment belongs to: 06:00 to 06:00 Copenhagen time.
create function private.dos_bonus_dag(p_tid timestamptz) returns date
language sql immutable set search_path = '' as $$
  select ((p_tid at time zone 'Europe/Copenhagen') - interval '6 hours')::date
$$;

-- Works out p_medlem's Dos-bonuses for day p_dag again (see the header).
-- p_aktoer annuls any surplus; p_batch is the Giv batch that caused it, if any.
-- Safe to run any number of times.
create function private.genberegn_dos_bonus(
  p_bodekasse uuid, p_medlem uuid, p_dag date, p_aktoer uuid, p_batch uuid default null)
returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_fra        timestamptz := (p_dag + time '06:00') at time zone 'Europe/Copenhagen';
  v_til        timestamptz := (p_dag + 1 + time '06:00') at time zone 'Europe/Copenhagen';
  v_niveau     int;
  v_maal       int := 0;
  v_har        int;
  v_kategorier jsonb;
  v_kasse      public.bodekasse;
  v_saeson     uuid;
  v_nr         int;
  v_id         uuid;
begin
  -- One recompute per Medlem and day at a time.
  perform pg_advisory_xact_lock(hashtextextended('dos_bonus:' || p_medlem || ':' || p_dag, 0));

  select coalesce(sum(t.antal / 2), 0)::int,
         coalesce(jsonb_agg(t.navn order by lower(t.navn)) filter (where t.antal >= 2), '[]')
    into v_niveau, v_kategorier
    from (select k.navn, count(*)::int as antal
            from public.bode b
            join public.bodekategori k on k.id = b.bodekategori_id
            left join public.anke a on a.bode_id = b.id
           where b.bodekasse_id = p_bodekasse
             and b.annulleret is null
             and b.givet >= v_fra and b.givet < v_til
             and case when a.afgoerelse = 'modtager_vandt' then b.giver_id
                      else b.modtager_id end = p_medlem
           group by k.id, k.navn) t;

  while v_niveau > 0 loop
    v_maal := v_maal + v_niveau;
    v_niveau := v_niveau / 2;
  end loop;

  select count(*) into v_har from public.gebyr
   where medlem_id = p_medlem and art = 'dos_bonus' and udloeser = p_dag and annulleret is null;

  if v_har > v_maal then
    update public.gebyr set annulleret = now(), annulleret_af = p_aktoer
     where id in (select id from public.gebyr
                   where medlem_id = p_medlem and art = 'dos_bonus' and udloeser = p_dag and annulleret is null
                   order by dos_nr desc
                   limit v_har - v_maal);
    return;
  end if;
  if v_har = v_maal then return; end if;

  select * into v_kasse from public.bodekasse where id = p_bodekasse;
  v_saeson := private.aktiv_saeson(p_bodekasse);
  if not v_kasse.dos_bonus_til or v_saeson is null
     or exists (select 1 from public.medlem where id = p_medlem and udmeldt is not null) then
    return;
  end if;

  -- Sequence numbers count annulled rows too, so they never repeat.
  select coalesce(max(dos_nr), 0) into v_nr from public.gebyr
   where medlem_id = p_medlem and art = 'dos_bonus' and udloeser = p_dag;

  for i in 1 .. v_maal - v_har loop
    insert into public.gebyr (bodekasse_id, saeson_id, medlem_id, art, beloeb,
                              udloeser, dos_nr, dos_batch_id)
    values (p_bodekasse, v_saeson, p_medlem, 'dos_bonus', v_kasse.dos_bonus_beloeb,
            p_dag, v_nr + i, p_batch)
    returning id into v_id;

    perform private.tilfoej_haendelse(
      p_bodekasse, null, 'dos_bonus',
      jsonb_build_object('dag', p_dag, 'beloeb', v_kasse.dos_bonus_beloeb,
                         'kategorier', v_kategorier),
      'gebyr', v_id, p_modtager => p_medlem, p_saeson => v_saeson);
  end loop;
end $$;

revoke execute on function private.dos_bonus_dag(timestamptz) from public, anon, authenticated;
revoke execute on function private.genberegn_dos_bonus(uuid, uuid, date, uuid, uuid)
  from public, anon, authenticated;

-- ---------- 4a. giv_boeder (from 20261011185646_giv_boeder.sql) ----------
-- + each receiver's Dos-bonus day is recomputed, after the feed entries.
create or replace function public.giv_boeder(p_klient_id uuid, p_bodekasse uuid, p_linjer jsonb)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_mig       uuid := private.mit_medlem(p_bodekasse);
  v_tidligere jsonb;
  v_saeson    uuid;
  v_batch     uuid := gen_random_uuid();
  v_linje     jsonb;
  v_r         record;
  v_antal     int := 0;
  v_beloeb    int := 0;
begin
  v_tidligere := private.start_kald(p_klient_id, 'giv_boeder');
  if v_tidligere is not null then return v_tidligere; end if;

  v_saeson := private.aktiv_saeson(p_bodekasse);
  if v_saeson is null then raise exception 'pause'; end if;
  if jsonb_typeof(p_linjer) is distinct from 'array' or jsonb_array_length(p_linjer) = 0 then
    raise exception 'ingen_boeder';
  end if;

  for v_linje in select * from jsonb_array_elements(p_linjer) loop
    perform private.giv_linje(p_bodekasse, v_saeson, v_batch, v_mig, v_linje);
  end loop;

  -- One feed entry per receiver.
  for v_r in
    select l.modtager_id,
           sum(l.antal)::int          as antal,
           sum(l.antal * l.pris)::int as beloeb,
           jsonb_agg(jsonb_build_object('navn', l.navn, 'pris', l.pris, 'antal', l.antal,
                                        'bodekategori_id', l.bodekategori_id)
                     order by lower(l.navn), l.pris) as linjer
      from (select b.modtager_id, b.bodekategori_id, coalesce(k.navn, b.grund) as navn,
                   b.pris, count(*) as antal
              from public.bode b
              left join public.bodekategori k on k.id = b.bodekategori_id
             where b.batch_id = v_batch
             group by b.modtager_id, b.bodekategori_id, coalesce(k.navn, b.grund), b.pris) l
     group by l.modtager_id
  loop
    perform private.tilfoej_haendelse(
      p_bodekasse, v_mig, 'boeder_givet',
      jsonb_build_object('antal', v_r.antal, 'beloeb', v_r.beloeb, 'linjer', v_r.linjer),
      p_batch_id => v_batch, p_modtager => v_r.modtager_id, p_saeson => v_saeson);
    v_antal := v_antal + v_r.antal;
    v_beloeb := v_beloeb + v_r.beloeb;
  end loop;

  -- Dos-bonus (#77).
  perform private.genberegn_dos_bonus(p_bodekasse, d.modtager_id, d.dag, v_mig, v_batch)
     from (select distinct b.modtager_id, private.dos_bonus_dag(b.givet) as dag
             from public.bode b
            where b.batch_id = v_batch and b.bodekategori_id is not null) d;

  return private.afslut_kald(p_klient_id,
    jsonb_build_object('batch_id', v_batch, 'antal', v_antal, 'beloeb', v_beloeb));
end $$;

-- ---------- 4b. annuller_bode (from 20261011220400_rpc_raekkefoelge.sql) ----------
-- + the Bøde's day is recomputed for its receiver and its giver (one of them bears it).
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
  select * into v_bode from public.bode where id = p_bode for update;
  if v_bode.id is null then raise exception 'ikke_fundet'; end if;
  v_mig := private.mit_medlem(v_bode.bodekasse_id);
  v_tidligere := private.start_kald(p_klient_id, 'annuller_bode');
  if v_tidligere is not null then return v_tidligere; end if;

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

  -- Dos-bonus (#77).
  if v_bode.bodekategori_id is not null then
    perform private.genberegn_dos_bonus(v_bode.bodekasse_id, p.medlem_id,
                                        private.dos_bonus_dag(v_bode.givet), v_mig)
       from (select distinct unnest(array[v_bode.modtager_id, v_bode.giver_id]) as medlem_id) p;
  end if;

  return private.afslut_kald(p_klient_id, jsonb_build_object('bode_id', v_bode.id));
end $$;

-- ---------- 4c. saet_afgoerelse (from 20261011220300_afgoerelse_aendret_af.sql) ----------
-- + after the verdict, the Bøde's day is recomputed for its receiver, then
--   its giver (one loses the Bøde, the other gains it).
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

  -- Dos-bonus (#77).
  if p_bode.bodekategori_id is not null then
    perform private.genberegn_dos_bonus(p_anke.bodekasse_id, p_bode.modtager_id,
                                        private.dos_bonus_dag(p_bode.givet), p_mig);
    if p_bode.giver_id <> p_bode.modtager_id then
      perform private.genberegn_dos_bonus(p_anke.bodekasse_id, p_bode.giver_id,
                                          private.dos_bonus_dag(p_bode.givet), p_mig);
    end if;
  end if;
end $$;

revoke execute on function private.saet_afgoerelse(public.anke, public.bode, uuid, public.anke_afgoerelse, boolean)
  from public, anon, authenticated;

-- ---------- 4d. fortryd_batch (from 20261011220400_rpc_raekkefoelge.sql) ----------
-- + the Dos-bonuses the batch charged go too, with their feed entries (Fortryd
--   leaves no trace), and the receivers' days are recomputed after.
create or replace function public.fortryd_batch(p_klient_id uuid, p_batch uuid)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_tidligere jsonb;
  v_bode      public.bode;
  v_mig       uuid;
  v_modtagere uuid[];
  v_dage      date[];
begin
  select * into v_bode from public.bode where batch_id = p_batch order by givet limit 1;
  if v_bode.id is null then
    -- Gone: a repeat of an undo that went through gets its first answer.
    v_tidligere := private.start_kald(p_klient_id, 'fortryd_batch');
    if v_tidligere is not null then return v_tidligere; end if;
    raise exception 'ikke_fundet';
  end if;
  v_mig := private.mit_medlem(v_bode.bodekasse_id);
  v_tidligere := private.start_kald(p_klient_id, 'fortryd_batch');
  if v_tidligere is not null then return v_tidligere; end if;

  if v_mig <> v_bode.giver_id then
    raise exception 'ikke_tilladt' using errcode = '42501';
  end if;
  perform 1 from public.bode where batch_id = p_batch for update;
  perform private.tjek_seneste_saeson(v_bode.bodekasse_id, v_bode.saeson_id);
  if now() > v_bode.givet + private.fortryd_frist() then
    raise exception 'fortryd_udloebet';
  end if;

  -- Dos-bonus (#77): the receivers' days, to recompute once the batch is gone.
  select array_agg(d.modtager_id), array_agg(d.dag) into v_modtagere, v_dage
    from (select distinct modtager_id, private.dos_bonus_dag(givet) as dag
            from public.bode where batch_id = p_batch and bodekategori_id is not null) d;

  begin
    delete from public.haendelse where batch_id = p_batch;
    -- Dos-bonus (#77): the ones this batch charged.
    delete from public.haendelse
     where ref_tabel = 'gebyr'
       and ref_id in (select id from public.gebyr where dos_batch_id = p_batch);
    delete from public.gebyr where dos_batch_id = p_batch;
    delete from public.gebyr
     where bode_id in (select id from public.bode where batch_id = p_batch);
    delete from public.bode where batch_id = p_batch;
  exception when foreign_key_violation then
    raise exception 'kan_ikke_fortrydes';
  end;

  perform private.genberegn_dos_bonus(v_bode.bodekasse_id, d.medlem_id, d.dag, v_mig)
     from unnest(v_modtagere, v_dage) as d(medlem_id, dag);
  return private.afslut_kald(p_klient_id, jsonb_build_object('batch_id', p_batch));
end $$;
