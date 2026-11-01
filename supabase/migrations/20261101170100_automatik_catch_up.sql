-- #78: the hourly scheduler and its first step, Catch-up.
--
-- 1. pg_cron (+ pg_net for the push sender, #83) and one hourly job that calls
--    private.koer_automatik(now()).
-- 2. private.koer_automatik(p_nu): for each Bødekasse it works out the local
--    Europe/Copenhagen date and runs every registered step. "Now" is an
--    argument: tests call it with chosen dates.
-- 3. Steps are DATA, not code: a row per step in private.automatik_trin. A
--    later ticket that adds a step inserts its row; it never redefines
--    koer_automatik (see "Adding a step" below).
-- 4. Idempotency: an automatic Gebyr stores its trigger in gebyr.udloeser
--    (plus whatever else identifies it), under a unique index that also
--    counts Annullerede rows. A second run never charges twice, and an
--    annulled automatic Gebyr is never charged again.
-- 5. Catch-up: on the 1st, the N lowest by Sæson total pay a Gebyr dated to
--    the last moment of last month. Off by default.
-- 6. annuller_gebyr also takes a Catch-up.
-- Additive only: new columns with defaults, functions, a table, an index,
-- and the Gebyr cause check widened so the new kinds fit.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- ---------- Settings (all off by default) ----------
alter table public.bodekasse
  add column if not exists catch_up_til    boolean not null default false,
  add column if not exists catch_up_antal  int     not null default 2  check (catch_up_antal > 0),
  add column if not exists catch_up_beloeb int     not null default 50 check (catch_up_beloeb > 0);

insert into private.indstilling (noegle) values
  ('catch_up_til'), ('catch_up_antal'), ('catch_up_beloeb')
on conflict (noegle) do nothing;

-- ---------- The trigger of an automatic Gebyr ----------
-- udloeser: the local (Europe/Copenhagen) date the automatic Gebyr belongs to.
--   catch_up        the 1st of the month it covers (paid on the 1st after it)
--   sen_betaling    the late day (#80)
--   tilbagevendende the occurrence date, with the rule's id (#79)
-- Each kind gets a unique index over its trigger WITHOUT an `annulleret is
-- null` filter, so annulled rows block a new charge too.
alter table public.gebyr add column if not exists udloeser date;

-- The old cause check required exactly one of the five cause columns, and
-- read any kind it didn't know as a Konkurrence Gebyr. Keep that rule for
-- the six old kinds; each automatic kind adds its own named check instead.
alter table public.gebyr drop constraint if exists gebyr_check;    -- num_nonnulls(...) = 1
alter table public.gebyr drop constraint if exists gebyr_check1;   -- case art ... else konkurrence_id
alter table public.gebyr add constraint gebyr_aarsag_check check (
  case art
    when 'oprettelse'  then bodekategori_id is not null
    when 'engangsbode' then bode_id is not null
    when 'anke'        then anke_id is not null
    when 'frikob'      then frikob_id is not null
    when 'placering'   then konkurrence_id is not null
    when 'fravaer'     then konkurrence_id is not null
    else true
  end
  and (art not in ('oprettelse', 'engangsbode', 'anke', 'frikob', 'placering', 'fravaer')
       or num_nonnulls(bodekategori_id, bode_id, anke_id, frikob_id, konkurrence_id) = 1));

-- Catch-up: no cause column, one per Medlem and month.
alter table public.gebyr add constraint gebyr_catch_up_check check (
  art <> 'catch_up'
  or (udloeser is not null and extract(day from udloeser) = 1
      and num_nonnulls(bodekategori_id, bode_id, anke_id, frikob_id, konkurrence_id) = 0));
create unique index if not exists gebyr_catch_up_unik
  on public.gebyr (medlem_id, udloeser) where art = 'catch_up';

-- ---------- Time helpers ----------
-- The local date in Copenhagen at a moment.
create or replace function private.lokal_dato(p_tid timestamptz) returns date
language sql immutable set search_path = '' as $$
  select (p_tid at time zone 'Europe/Copenhagen')::date
$$;

-- A local date and clock time in Copenhagen as a moment (default: midnight).
create or replace function private.lokal_tid(p_dato date, p_klokken time default '00:00')
returns timestamptz
language sql immutable set search_path = '' as $$
  select (p_dato + p_klokken) at time zone 'Europe/Copenhagen'
$$;

-- The Sæson that ran in a box at a moment, or null (a Pause). Same rule as
-- saeson_status.koerer, but at p_tid instead of now(): the latest Sæson
-- started by then, if it hadn't ended yet.
create or replace function private.saeson_paa(p_bodekasse uuid, p_tid timestamptz) returns uuid
language sql stable security definer set search_path = '' as $$
  select s.id
    from (select * from public.saeson
           where bodekasse_id = p_bodekasse and startet <= p_tid
           order by loebenr desc limit 1) s
   where p_tid < coalesce(least(s.afsluttet,
                                (s.slutdato + 1)::timestamp at time zone 'Europe/Copenhagen'),
                          'infinity')
$$;

-- ---------- Steps ----------
-- funktion: a private function (p_kasse public.bodekasse, p_nu timestamptz,
--   p_dato date) returns void. p_dato is the box's local date at p_nu. It
--   works out for itself whether anything is due, and must be idempotent:
--   it is called every hour, and again after a missed run.
-- raekkefoelge: steps run in this order per box (lowest first). Catch-up runs
--   first: Sen betaling's "owed" includes the Catch-up dated to last month.
--
-- Adding a step (later tickets), in your own migration:
--   create function private.automatik_x(p_kasse public.bodekasse, p_nu timestamptz, p_dato date)
--   returns void ... ;
--   insert into private.automatik_trin (navn, funktion, raekkefoelge)
--   values ('x', 'private.automatik_x', 30);
create table private.automatik_trin (
  navn          text primary key,
  funktion      regproc not null,
  raekkefoelge  int not null
);

-- ---------- koer_automatik ----------
-- Runs every step for every box at p_nu. The hourly job passes now(); tests
-- pass chosen moments. A failing step only rolls back that step for that
-- box (raised as a warning), so one bad box never blocks the rest.
create or replace function private.koer_automatik(p_nu timestamptz) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_kasse public.bodekasse;
  v_trin  private.automatik_trin;
  v_dato  date;
begin
  for v_kasse in select * from public.bodekasse order by id loop
    v_dato := private.lokal_dato(p_nu);   -- every box keeps Copenhagen time
    for v_trin in select * from private.automatik_trin order by raekkefoelge, navn loop
      begin
        execute format('select %s($1, $2, $3)', v_trin.funktion) using v_kasse, p_nu, v_dato;
      exception when others then
        raise warning 'koer_automatik: step % failed for box %: % (%)',
          v_trin.navn, v_kasse.id, sqlerrm, sqlstate;
      end;
    end loop;
  end loop;
end $$;

-- ---------- Catch-up ----------
-- Due on the 1st (local date) when Catch-up is on and the same Sæson runs at
-- p_nu and at the start of last month's last day: no run in a Pause, and
-- none when a Sæson ended or began in between.
-- Ranking: active (not Udmeldt) Medlemmer by Sæson total, i.e. the
-- non-annulled Bøder they bear plus their non-annulled Gebyrer in that Sæson,
-- up to the end of last month (earlier Catch-ups included). The N lowest pay,
-- plus everyone tied with the Nth (rank() <= N). The amount is the setting
-- now; the Gebyr is dated to the last moment of last month.
-- Once per box and month: when any Catch-up for the month exists (annulled
-- too), the month is done, so a later correction to the totals never adds
-- payers. Each charge gets a feed entry 'catch_up' {maaned, beloeb, total}
-- from the system (no aktoer), about the Gebyr (ref gebyr), for the payer.
create or replace function private.automatik_catch_up(
  p_kasse public.bodekasse, p_nu timestamptz, p_dato date)
returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_maaned  date := (p_dato - interval '1 month')::date;  -- the 1st of the month covered
  v_graense timestamptz := private.lokal_tid(p_dato);     -- totals count up to here
  v_saeson  uuid;
  v_medlem  uuid;
  v_total   int;
  v_id      uuid;
begin
  if not p_kasse.catch_up_til or extract(day from p_dato) <> 1 then return; end if;

  v_saeson := private.saeson_paa(p_kasse.id, p_nu);
  if v_saeson is null
     or v_saeson is distinct from private.saeson_paa(p_kasse.id, private.lokal_tid(p_dato - 1)) then
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
       where m.bodekasse_id = p_kasse.id and (m.udmeldt is null or m.udmeldt > p_nu)
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

insert into private.automatik_trin (navn, funktion, raekkefoelge)
values ('catch_up', 'private.automatik_catch_up', 10)
on conflict (navn) do nothing;

-- ---------- annuller_gebyr (from 20261011220400_rpc_raekkefoelge.sql) ----------
-- As before, plus: an Admin can annul a Catch-up on its own. Its unique index
-- keeps the annulled row, so the automation never charges that month again.
-- The feed entry's `navn` is null for a Catch-up (the client names the kind).
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
  v_mig := private.mit_admin(v_gebyr.bodekasse_id);
  v_tidligere := private.start_kald(p_klient_id, 'annuller_gebyr');
  if v_tidligere is not null then return v_tidligere; end if;

  if v_gebyr.art not in ('oprettelse', 'anke', 'catch_up') then raise exception 'kan_ikke_annulleres'; end if;
  if v_gebyr.annulleret is not null then raise exception 'allerede_annulleret'; end if;
  perform private.tjek_seneste_saeson(v_gebyr.bodekasse_id, v_gebyr.saeson_id);

  update public.gebyr
     set annulleret = now(), annulleret_af = v_mig, annulleret_note = v_note
   where id = v_gebyr.id;

  if v_gebyr.art = 'oprettelse' then
    select navn into v_navn from public.bodekategori where id = v_gebyr.bodekategori_id;
  elsif v_gebyr.art = 'anke' then
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

-- ---------- The hourly job ----------
-- On the hour, every hour (UTC). cron.schedule with a name replaces a job of
-- that name, so re-running this is safe. A failure to schedule (e.g. a
-- database where cron can't run jobs) is a warning, not a failed migration.
do $$
begin
  perform cron.schedule('koer_automatik', '0 * * * *', 'select private.koer_automatik(now())');
exception when others then
  raise warning 'could not schedule koer_automatik: % (%)', sqlerrm, sqlstate;
end $$;
