-- Spec #74 code review fixes. One migration, after every #74 ticket.
--
-- 1. Dos-bonus annulled by hand. An Admin or a Kasserer may annul a single
--    Dos-bonus (annuller_gebyr), and it stays annulled: the recompute counts
--    a Dos-bonus annulled by hand as already charged. Surplus is still
--    annulled automatically. gebyr.annulleret_manuelt tells the two apart.
-- 2. Missed scheduler runs catch up. Each run also handles the occurrences of
--    the last 7 local days (today and the 6 before) that are still
--    uncharged, each by its own day's rules (private.automatik_dage). The
--    unique indexes stay the idempotency guarantee. A day before an automatic
--    rule was switched on is never caught up (bodekasse.*_til_siden).
-- 3. private.medlem_aktiv_paa: a Medlem was active at a moment unless the
--    latest Udmeld/Genoptag at or before it was an Udmeld. A later Genoptag
--    no longer makes every earlier moment inactive.
-- 4. private.kan_haandtere_penge(medlem): the "may handle money" rule as a
--    boolean. private.mine_penge and the Betalingsmelding venter push use it.
--
-- Redefined, each from its latest definition (named above it):
--   private.mine_penge, private.push_betalingsmelding, private.medlem_aktiv_paa,
--   public.annuller_gebyr, private.genberegn_dos_bonus,
--   private.automatik_catch_up, private.automatik_tilbagevendende,
--   private.automatik_sen_betaling.
-- Additive only: columns with defaults, functions, a trigger, a check. RPC
-- names and arguments unchanged.

-- ---------- 4. May handle money ----------

-- True when the Medlem is active (not Udmeldt) and Admin or Kasserer.
create function private.kan_haandtere_penge(p_medlem uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.medlem
                  where id = p_medlem and udmeldt is null and (er_admin or er_kasserer))
$$;

revoke execute on function private.kan_haandtere_penge(uuid) from public, anon, authenticated;

-- mine_penge (from 20261101100000_kasserer.sql): unchanged behaviour, now
-- through the shared rule. mit_medlem already rejects an Udmeldt.
create or replace function private.mine_penge(p_bodekasse uuid) returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare v_id uuid := private.mit_medlem(p_bodekasse);
begin
  if not private.kan_haandtere_penge(v_id) then
    raise exception 'ikke_kasserer' using errcode = '42501';
  end if;
  return v_id;
end $$;

-- push_betalingsmelding (from 20261101210000_push_anke_betaling.sql): the
-- recipients are the Medlemmer who may handle money, never the reporter.
create or replace function private.push_betalingsmelding() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_kasse  text;
  v_navn   text;
  v_m      record;
begin
  if new.status <> 'afventer' then return null; end if;
  select navn into v_kasse from public.bodekasse where id = new.bodekasse_id;
  select navn into v_navn from public.medlem where id = new.medlem_id;
  for v_m in
    select user_id from public.medlem
     where bodekasse_id = new.bodekasse_id and user_id is not null
       and private.kan_haandtere_penge(id) and id <> new.medlem_id
  loop
    perform private.push(
      v_m.user_id, 'betalingsmelding_venter', new.bodekasse_id,
      'Betaling venter i ' || v_kasse,
      coalesce(v_navn, 'Nogen') || ' har betalt ' || private.kr(new.beloeb)
        || '. Bekræft eller afvis den.',
      '/kassen');
  end loop;
  return null;
end $$;

-- ---------- 3. Active at a moment ----------
-- medlem_aktiv_paa (from 20261101200000_sen_betaling.sql). udmeld writes a
-- 'medlem_udmeldt' feed entry and sets medlem.udmeldt; genoptag writes
-- 'medlem_genoptaget' and clears it (both ref medlem). So the Medlem was
-- active at p_tid unless they are Udmeldt since p_tid or earlier, or the
-- latest of those entries at or before p_tid is an Udmeld. A Medlem who is
-- brought back counts again from that moment, with nothing for the gap, and
-- the time before they left still counts.
create or replace function private.medlem_aktiv_paa(p_medlem uuid, p_tid timestamptz)
returns boolean
language sql stable security definer set search_path = '' as $$
  select (m.udmeldt is null or m.udmeldt > p_tid)
         and coalesce((select h.art <> 'medlem_udmeldt'
                         from public.haendelse h
                        where h.ref_tabel = 'medlem' and h.ref_id = m.id
                          and h.art in ('medlem_udmeldt', 'medlem_genoptaget')
                          and h.tid <= p_tid
                        order by h.tid desc, h.id desc
                        limit 1), true)
    from public.medlem m where m.id = p_medlem
$$;

-- ---------- 1. Dos-bonus annulled by hand ----------

-- True when the Gebyr was annulled on its own with annuller_gebyr (from this
-- migration on; older rows say false). False when it went with its cause or
-- the Dos-bonus recompute took it back. The Dos-bonus recompute reads it.
alter table public.gebyr
  add column annulleret_manuelt boolean not null default false;
alter table public.gebyr add constraint gebyr_annulleret_manuelt_check
  check (not annulleret_manuelt or annulleret is not null);

-- annuller_gebyr (from 20261101220000_tilbagevendende.sql). As before
-- (Sen betaling: Admin or Kasserer; creation, Anke, Catch-up and
-- Tilbagevendende: Admin), plus: an Admin or a Kasserer can annul a single
-- Dos-bonus. The row is marked annulleret_manuelt, so the recompute counts
-- it as charged and never charges it again. The feed entry's `navn` is null
-- for a Dos-bonus (the client names the kind).
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
  select * into v_gebyr from public.gebyr where id = p_gebyr for update;
  if v_gebyr.id is null then raise exception 'ikke_fundet'; end if;
  if v_gebyr.art in ('sen_betaling', 'dos_bonus') then
    v_mig := private.mine_penge(v_gebyr.bodekasse_id);
  else
    v_mig := private.mit_admin(v_gebyr.bodekasse_id);
  end if;
  v_tidligere := private.start_kald(p_klient_id, 'annuller_gebyr');
  if v_tidligere is not null then return v_tidligere; end if;

  if v_gebyr.art not in ('oprettelse', 'anke', 'catch_up', 'sen_betaling', 'tilbagevendende', 'dos_bonus') then
    raise exception 'kan_ikke_annulleres';
  end if;
  if v_gebyr.annulleret is not null then raise exception 'allerede_annulleret'; end if;
  perform private.tjek_seneste_saeson(v_gebyr.bodekasse_id, v_gebyr.saeson_id);

  update public.gebyr
     set annulleret = now(), annulleret_af = v_mig, annulleret_note = v_note,
         annulleret_manuelt = true
   where id = v_gebyr.id;

  if v_gebyr.art = 'oprettelse' then
    select navn into v_navn from public.bodekategori where id = v_gebyr.bodekategori_id;
  elsif v_gebyr.art = 'anke' then
    select coalesce(k.navn, b.grund) into v_navn
      from public.anke a
      join public.bode b on b.id = a.bode_id
      left join public.bodekategori k on k.id = b.bodekategori_id
     where a.id = v_gebyr.anke_id;
  elsif v_gebyr.art = 'tilbagevendende' then
    select navn into v_navn from public.tilbagevendende where id = v_gebyr.tilbagevendende_id;
  end if;

  perform private.tilfoej_haendelse(
    v_gebyr.bodekasse_id, v_mig, 'gebyr_annulleret',
    jsonb_build_object('gebyr_id', v_gebyr.id, 'art', v_gebyr.art, 'navn', v_navn,
                       'beloeb', v_gebyr.beloeb, 'note', v_note),
    p_modtager => v_gebyr.medlem_id, p_saeson => v_gebyr.saeson_id);

  return private.afslut_kald(p_klient_id, jsonb_build_object('gebyr_id', v_gebyr.id));
end $$;

-- genberegn_dos_bonus (from 20261101180000_dos_bonus.sql). As before, but
-- step 3 compares the target with the Dos-bonuses already charged: the
-- non-annulled ones plus those annulled by hand (forgiven, so never charged
-- again). Surplus beyond the target annuls non-annulled ones, newest first;
-- a Dos-bonus annulled by hand absorbs surplus before any is annulled.
create or replace function private.genberegn_dos_bonus(
  p_bodekasse uuid, p_medlem uuid, p_dag date, p_aktoer uuid, p_batch uuid default null)
returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_fra        timestamptz := (p_dag + time '06:00') at time zone 'Europe/Copenhagen';
  v_til        timestamptz := (p_dag + 1 + time '06:00') at time zone 'Europe/Copenhagen';
  v_niveau     int;
  v_maal       int := 0;
  v_har        int;   -- not annulled
  v_tilgivet   int;   -- annulled by hand
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

  select count(*) filter (where annulleret is null)::int,
         count(*) filter (where annulleret_manuelt)::int
    into v_har, v_tilgivet
    from public.gebyr
   where medlem_id = p_medlem and art = 'dos_bonus' and udloeser = p_dag;

  if v_har + v_tilgivet > v_maal then
    update public.gebyr set annulleret = now(), annulleret_af = p_aktoer
     where id in (select id from public.gebyr
                   where medlem_id = p_medlem and art = 'dos_bonus' and udloeser = p_dag and annulleret is null
                   order by dos_nr desc
                   limit least(v_har, v_har + v_tilgivet - v_maal));
    return;
  end if;
  if v_har + v_tilgivet = v_maal then return; end if;

  select * into v_kasse from public.bodekasse where id = p_bodekasse;
  v_saeson := private.aktiv_saeson(p_bodekasse);
  if not v_kasse.dos_bonus_til or v_saeson is null
     or exists (select 1 from public.medlem where id = p_medlem and udmeldt is not null) then
    return;
  end if;

  -- Sequence numbers count annulled rows too, so they never repeat.
  select coalesce(max(dos_nr), 0) into v_nr from public.gebyr
   where medlem_id = p_medlem and art = 'dos_bonus' and udloeser = p_dag;

  for i in 1 .. v_maal - v_har - v_tilgivet loop
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

-- ---------- 2. Missed scheduler runs catch up ----------

-- When Catch-up and Sen betaling were last switched on (null: not since this
-- migration). A trigger stamps it whenever the setting goes from off to on.
-- A caught-up day must come after it; today is always judged by the setting
-- now, as before.
alter table public.bodekasse
  add column catch_up_til_siden     timestamptz,
  add column sen_betaling_til_siden timestamptz;

create function private.stempl_til_siden() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.catch_up_til and (tg_op = 'INSERT' or not old.catch_up_til) then
    new.catch_up_til_siden := now();
  end if;
  if new.sen_betaling_til and (tg_op = 'INSERT' or not old.sen_betaling_til) then
    new.sen_betaling_til_siden := now();
  end if;
  return new;
end $$;

create trigger stempl_til_siden before insert or update of catch_up_til, sen_betaling_til
  on public.bodekasse for each row execute function private.stempl_til_siden();

-- The local dates a run at p_dato handles: the last 7, oldest first, today
-- last. A whole day of failed runs (e.g. a paused project) is caught up by
-- any run in the next 6 days.
create function private.automatik_dage(p_dato date) returns setof date
language sql immutable set search_path = '' as $$
  select (p_dato - i)::date from generate_series(6, 0, -1) i
$$;

-- Was the setting on during day p_dag? Today: yes (the caller checked it is
-- on now). An earlier day: only if it was switched on before that day ended.
create function private.til_paa_dag(p_siden timestamptz, p_dag date, p_dato date) returns boolean
language sql immutable set search_path = '' as $$
  select p_dag = p_dato or coalesce(p_siden < private.lokal_tid(p_dag + 1), false)
$$;

-- The moment that says who was active on day p_dag: now for today, the last
-- moment of that day for an earlier one.
create function private.dagens_tid(p_dag date, p_nu timestamptz) returns timestamptz
language sql immutable set search_path = '' as $$
  select least(p_nu, private.lokal_tid(p_dag + 1) - interval '1 microsecond')
$$;

revoke execute on function private.automatik_dage(date) from public, anon, authenticated;
revoke execute on function private.til_paa_dag(timestamptz, date, date) from public, anon, authenticated;
revoke execute on function private.dagens_tid(date, timestamptz) from public, anon, authenticated;

-- ---------- Catch-up (from 20261101170100_automatik_catch_up.sql) ----------
-- Due for the 1st within the last 7 local days, when Catch-up is on now and
-- was on during that 1st. The 1st's own rules: the same Sæson runs at the
-- start of the 1st and at the start of last month's last day, and it is the
-- box's latest Sæson (a closed Sæson is never changed). Ranking: Medlemmer
-- active on the 1st (now, for today), by Sæson total up to the end of last
-- month; the N lowest pay, plus everyone tied with the Nth. The amount is the
-- setting now; the Gebyr is dated to the last moment of last month.
-- Once per box and month: when any Catch-up for the month exists (annulled
-- too), the month is done. Feed entry 'catch_up' {maaned, beloeb, total} as before.
create or replace function private.automatik_catch_up(
  p_kasse public.bodekasse, p_nu timestamptz, p_dato date)
returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_dag     date;          -- the 1st being charged
  v_maaned  date;          -- the 1st of the month covered
  v_graense timestamptz;   -- totals count up to here
  v_aktiv   timestamptz;   -- who was active then
  v_saeson  uuid;
  v_medlem  uuid;
  v_total   int;
  v_id      uuid;
begin
  if not p_kasse.catch_up_til then return; end if;
  select d into v_dag from private.automatik_dage(p_dato) d where extract(day from d) = 1;
  if v_dag is null or not private.til_paa_dag(p_kasse.catch_up_til_siden, v_dag, p_dato) then
    return;
  end if;

  v_maaned  := (v_dag - interval '1 month')::date;
  v_graense := private.lokal_tid(v_dag);
  v_aktiv   := private.dagens_tid(v_dag, p_nu);
  v_saeson  := private.saeson_paa(p_kasse.id, v_graense);
  if v_saeson is null
     or v_saeson is distinct from private.saeson_paa(p_kasse.id, private.lokal_tid(v_dag - 1))
     or v_saeson is distinct from private.seneste_saeson(p_kasse.id) then
    return;
  end if;

  if exists (select 1 from public.gebyr
              where bodekasse_id = p_kasse.id and art = 'catch_up' and udloeser = v_maaned) then
    return;
  end if;

  for v_medlem, v_total in
    with total as (
      select m.id,
             ( coalesce((select sum(b.pris) from public.bode_baerer b
                          where b.baerer_id = m.id and b.saeson_id = v_saeson
                            and b.givet < v_graense), 0)
             + coalesce((select sum(g.beloeb) from public.gebyr g
                          where g.medlem_id = m.id and g.saeson_id = v_saeson
                            and g.annulleret is null and g.oprettet < v_graense), 0)
             )::int as total
        from public.medlem m
       where m.bodekasse_id = p_kasse.id and private.medlem_aktiv_paa(m.id, v_aktiv)
    )
    select r.id, r.total
      from (select t.id, t.total, rank() over (order by t.total) as plads from total t) r
     where r.plads <= p_kasse.catch_up_antal
     order by r.total, r.id
  loop
    insert into public.gebyr (bodekasse_id, saeson_id, medlem_id, art, beloeb, udloeser, oprettet)
    values (p_kasse.id, v_saeson, v_medlem, 'catch_up', p_kasse.catch_up_beloeb, v_maaned,
            v_graense - interval '1 microsecond')
    on conflict do nothing
    returning id into v_id;

    if v_id is not null then
      perform private.tilfoej_haendelse(
        p_kasse.id, null, 'catch_up',
        jsonb_build_object('maaned', v_maaned, 'beloeb', p_kasse.catch_up_beloeb, 'total', v_total),
        'gebyr', v_id, p_modtager => v_medlem, p_saeson => v_saeson);
    end if;
  end loop;
end $$;

-- ---------- Tilbagevendende (from 20261101220000_tilbagevendende.sql) ----------
-- For each of the last 7 local days D, oldest first: each Tilbagevendende
-- Gebyr of the box that falls on D (weekday or day of month), was last
-- changed before the start of D, and was not stopped during D (today: not
-- stopped at all), charges each listed Medlem active on D (now, for today),
-- when a Sæson runs at the start of D and it is the box's latest Sæson. An
-- edit after D began means D's version is gone, so a missed D is then not
-- caught up. The Gebyr is dated to the start of D, udloeser = D. Each new
-- charge gets a feed entry 'tilbagevendende' {navn, beloeb, dato} as before.
create or replace function private.automatik_tilbagevendende(
  p_kasse public.bodekasse, p_nu timestamptz, p_dato date)
returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_seneste         uuid := private.seneste_saeson(p_kasse.id);
  v_dag             date;
  v_start           timestamptz;
  v_slut            timestamptz;
  v_saeson          uuid;
  v_tilbagevendende public.tilbagevendende;
  v_medlem          uuid;
  v_id              uuid;
begin
  for v_dag in select d from private.automatik_dage(p_dato) d loop
    v_start  := private.lokal_tid(v_dag);
    v_slut   := private.lokal_tid(v_dag + 1);
    v_saeson := private.saeson_paa(p_kasse.id, v_start);
    continue when v_saeson is null or v_saeson is distinct from v_seneste;

    for v_tilbagevendende in
      select * from public.tilbagevendende r
       where r.bodekasse_id = p_kasse.id and r.aendret < v_start
         and (r.stoppet is null or (v_dag < p_dato and r.stoppet >= v_slut))
         and r.dag = case r.frekvens when 'uge' then extract(isodow from v_dag)::int
                                     else extract(day from v_dag)::int end
       order by r.oprettet, r.id
    loop
      for v_medlem in
        select m.id from public.tilbagevendende_medlem tm
          join public.medlem m on m.id = tm.medlem_id
         where tm.tilbagevendende_id = v_tilbagevendende.id
           and private.medlem_aktiv_paa(m.id, private.dagens_tid(v_dag, p_nu))
         order by m.id
      loop
        insert into public.gebyr (bodekasse_id, saeson_id, medlem_id, art, beloeb,
                                  tilbagevendende_id, udloeser, oprettet)
        values (p_kasse.id, v_saeson, v_medlem, 'tilbagevendende', v_tilbagevendende.beloeb,
                v_tilbagevendende.id, v_dag, v_start)
        on conflict do nothing
        returning id into v_id;

        if v_id is not null then
          perform private.tilfoej_haendelse(
            p_kasse.id, null, 'tilbagevendende',
            jsonb_build_object('navn', v_tilbagevendende.navn, 'beloeb', v_tilbagevendende.beloeb,
                               'dato', v_dag),
            'gebyr', v_id, p_modtager => v_medlem, p_saeson => v_saeson);
        end if;
      end loop;
    end loop;
  end loop;
end $$;

-- ---------- Sen betaling (from 20261101200000_sen_betaling.sql) ----------
-- As before for this month: every qualifying late day from the day after the
-- Betalingsdag up to today (back-charging after a rejection or an annulled
-- Indbetaling). New: when the last 7 local days reach into last month, its
-- late days among them are handled too, by last month's owed and paid, and
-- only if Sen betaling was on during that day. Last month runs first, so its
-- late fees count in this month's owed. Each Medlem active now, each day
-- only when they were active at its start (private.medlem_aktiv_paa). The
-- cap, the latest-Sæson rule, the dating and the feed entry are as before.
create or replace function private.automatik_sen_betaling(
  p_kasse public.bodekasse, p_nu timestamptz, p_dato date)
returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_denne   date := date_trunc('month', p_dato)::date;
  v_seneste uuid := private.seneste_saeson(p_kasse.id);
  v_maaned  date;
  v_fra     date;   -- first day to look at in v_maaned
  v_til     date;   -- last day to look at in v_maaned
  v_medlem  uuid;
  v_skyldig int;
  v_betalt  int;
  v_dag     date;
  v_saeson  uuid;
  v_beloeb  int;
  v_id      uuid;
begin
  if not p_kasse.sen_betaling_til then return; end if;

  for v_maaned in
    select distinct date_trunc('month', d)::date from private.automatik_dage(p_dato) d order by 1
  loop
    v_fra := v_maaned + p_kasse.betalingsdag;   -- the first late day of v_maaned
    if v_maaned = v_denne then
      v_til := p_dato;
    else
      v_fra := greatest(v_fra, p_dato - 6);
      v_til := (v_maaned + interval '1 month')::date - 1;
    end if;
    continue when v_fra > v_til;

    for v_medlem in
      select m.id from public.medlem m
       where m.bodekasse_id = p_kasse.id and (m.udmeldt is null or m.udmeldt > p_nu)
       order by m.id
    loop
      v_skyldig := private.skyldig(v_medlem, v_maaned);
      continue when v_skyldig <= 0;

      for v_dag in select d::date from generate_series(v_fra, v_til, interval '1 day') d loop
        continue when exists (select 1 from public.gebyr
                               where medlem_id = v_medlem and art = 'sen_betaling' and udloeser = v_dag);
        continue when v_maaned <> v_denne
                  and not private.til_paa_dag(p_kasse.sen_betaling_til_siden, v_dag, p_dato);
        v_saeson := private.saeson_paa(p_kasse.id, private.lokal_tid(v_dag));
        continue when v_saeson is null or v_saeson is distinct from v_seneste;
        continue when not private.medlem_aktiv_paa(v_medlem, private.lokal_tid(v_dag));
        v_betalt := private.betalt(v_medlem, v_maaned, private.lokal_tid(v_dag));
        continue when v_betalt >= v_skyldig;

        v_beloeb := p_kasse.sen_betaling_beloeb;
        if p_kasse.sen_betaling_loft is not null then
          v_beloeb := least(v_beloeb, p_kasse.sen_betaling_loft - coalesce(
            (select sum(beloeb) from public.gebyr
              where medlem_id = v_medlem and art = 'sen_betaling' and annulleret is null
                and udloeser >= v_maaned and udloeser < (v_maaned + interval '1 month')::date), 0));
          exit when v_beloeb <= 0;
        end if;

        insert into public.gebyr (bodekasse_id, saeson_id, medlem_id, art, beloeb, udloeser, oprettet)
        values (p_kasse.id, v_saeson, v_medlem, 'sen_betaling', v_beloeb, v_dag, private.lokal_tid(v_dag))
        on conflict do nothing
        returning id into v_id;

        if v_id is not null then
          perform private.tilfoej_haendelse(
            p_kasse.id, null, 'sen_betaling',
            jsonb_build_object('dag', v_dag, 'beloeb', v_beloeb, 'skyldig', v_skyldig, 'betalt', v_betalt),
            'gebyr', v_id, p_modtager => v_medlem, p_saeson => v_saeson);
        end if;
      end loop;
    end loop;
  end loop;
end $$;
