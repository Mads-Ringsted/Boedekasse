-- #80: Sen betaling, a late fee per day, charged by the automation function.
--
-- For month M (by the Copenhagen calendar):
--   owed(M)    = the Medlem's Saldo at the end of M−1 (private.skyldig).
--   paid(M, t) = money in from the start of M up to t (private.betalt).
--   Money in   = Indbetalinger, dated by registration, or by the original
--                report time when they came from a Betalingsmelding, plus
--                pending Betalingsmeldinger by report time (private.penge_ind).
--                The same timeline gives the Saldo behind owed, so a report
--                made on the last day of M−1 counts there, pending or not.
-- A day D in M with D > Betalingsdag gets one late-day Gebyr when D is inside
-- a running Sæson, the Medlem is active on D, owed(M) > 0 and
-- paid(M, start of D) < owed(M). The Gebyr is dated to the start of D, so
-- late fees charged during M count in owed(M+1), not owed(M).
-- Every run looks at every day of M so far: a rejected Betalingsmelding or an
-- annulled Indbetaling back-charges the missed days on the next run. The
-- unique index counts annulled rows, so a forgiven day is never charged again.
--
-- Also: an Admin or a Kasserer may annul a late-day Gebyr (annuller_gebyr).
-- Additive only: new columns with defaults (off), functions, a check, an
-- index and a scheduler step (private.automatik_trin, order 30).

-- ---------- Settings (off by default) ----------
alter table public.bodekasse
  add column if not exists sen_betaling_til    boolean not null default false,
  add column if not exists betalingsdag        int     not null default 1
    check (betalingsdag between 1 and 28),
  add column if not exists sen_betaling_beloeb int     not null default 25 check (sen_betaling_beloeb > 0),
  add column if not exists sen_betaling_loft   int     check (sen_betaling_loft > 0);   -- null: no cap

insert into private.indstilling (noegle) values
  ('sen_betaling_til'), ('betalingsdag'), ('sen_betaling_beloeb'), ('sen_betaling_loft')
on conflict (noegle) do nothing;

-- ---------- The Gebyr: one per Medlem and late day ----------
-- udloeser is the late day. No cause column. The index has no `annulleret is
-- null` filter: an annulled day blocks a new charge for that day.
alter table public.gebyr add constraint gebyr_sen_betaling_check check (
  art <> 'sen_betaling'
  or (udloeser is not null
      and num_nonnulls(bodekategori_id, bode_id, anke_id, frikob_id, konkurrence_id) = 0));
create unique index if not exists gebyr_sen_betaling_unik
  on public.gebyr (medlem_id, udloeser) where art = 'sen_betaling';

-- ---------- Owed and paid (shared with payment reminders, #83) ----------
-- All take explicit moments, never now(), so the scheduler can pass p_nu.

-- Money a Medlem put in during [p_fra, p_til): non-annulled Indbetalinger,
-- dated by registration or, when confirmed from a Betalingsmelding, by its
-- report time; plus pending Betalingsmeldinger by report time. Rejected and
-- withdrawn reports don't count.
create or replace function private.penge_ind(p_medlem uuid, p_fra timestamptz, p_til timestamptz)
returns int
language sql stable security definer set search_path = '' as $$
  select ( coalesce((select sum(i.beloeb)
                       from public.indbetaling i
                       left join public.betalingsmelding b on b.id = i.betalingsmelding_id
                      where i.medlem_id = p_medlem and i.annulleret is null
                        and coalesce(b.meldt, i.registreret) >= p_fra
                        and coalesce(b.meldt, i.registreret) <  p_til), 0)
         + coalesce((select sum(b.beloeb)
                       from public.betalingsmelding b
                      where b.medlem_id = p_medlem and b.status = 'afventer'
                        and b.meldt >= p_fra and b.meldt < p_til), 0)
         )::int
$$;

-- owed(M): the Medlem's Saldo at the start of month M (p_maaned: any day in
-- it), i.e. at the end of M−1. Bøder they bear given before then, plus
-- non-annulled Gebyrer dated before then (Catch-up for M−1 and M−1's late
-- fees included), minus money in before then. Negative = Til gode.
create or replace function private.skyldig(p_medlem uuid, p_maaned date)
returns int
language sql stable security definer set search_path = '' as $$
  with t as (select private.lokal_tid(date_trunc('month', p_maaned)::date) as graense)
  select ( coalesce((select sum(b.pris) from public.bode_baerer b, t
                      where b.baerer_id = p_medlem and b.givet < t.graense), 0)
         + coalesce((select sum(g.beloeb) from public.gebyr g, t
                      where g.medlem_id = p_medlem and g.annulleret is null
                        and g.oprettet < t.graense), 0)
         - private.penge_ind(p_medlem, '-infinity', (select graense from t))
         )::int
$$;

-- paid(M, t): money in from the start of month M (p_maaned: any day in it)
-- up to p_til.
create or replace function private.betalt(p_medlem uuid, p_maaned date, p_til timestamptz)
returns int
language sql stable security definer set search_path = '' as $$
  select private.penge_ind(p_medlem, private.lokal_tid(date_trunc('month', p_maaned)::date), p_til)
$$;

-- "paid < owed" for month M at p_til: the Medlem owed something at the end
-- of M−1 and hasn't paid it all since.
create or replace function private.er_bagud(p_medlem uuid, p_maaned date, p_til timestamptz)
returns boolean
language sql stable security definer set search_path = '' as $$
  select s.skyldig > 0 and private.betalt(p_medlem, p_maaned, p_til) < s.skyldig
    from (select private.skyldig(p_medlem, p_maaned) as skyldig) s
$$;

-- Was the Medlem active (not Udmeldt) at p_tid? Udmeldt by then, or brought
-- back (Genoptag) after it, counts as not active: a Medlem who is brought
-- back is included again from then, with nothing charged for the gap.
create or replace function private.medlem_aktiv_paa(p_medlem uuid, p_tid timestamptz)
returns boolean
language sql stable security definer set search_path = '' as $$
  select (m.udmeldt is null or m.udmeldt > p_tid)
         and not exists (select 1 from public.haendelse h
                          where h.ref_tabel = 'medlem' and h.ref_id = m.id
                            and h.art = 'medlem_genoptaget' and h.tid > p_tid)
    from public.medlem m where m.id = p_medlem
$$;

-- ---------- The step ----------
-- Runs every hour. When Sen betaling is on and today is after the
-- Betalingsdag, it charges each Medlem active now every qualifying late day
-- from the day after the Betalingsdag up to today, in this month only.
-- A day counts as in a Sæson when one runs at its start (as for Catch-up),
-- and only the box's latest Sæson is charged, so a closed Sæson is never
-- changed. The amount is the setting now. With a cap, the non-annulled late
-- fees for the month never go above it: the last one tops up to the cap.
-- Each charge gets a feed entry 'sen_betaling' {dag, beloeb, skyldig, betalt}
-- from the system (no aktoer), about the Gebyr (ref gebyr), for the payer.
create or replace function private.automatik_sen_betaling(
  p_kasse public.bodekasse, p_nu timestamptz, p_dato date)
returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_maaned  date := date_trunc('month', p_dato)::date;
  v_forste  date := date_trunc('month', p_dato)::date + p_kasse.betalingsdag;  -- first late day
  v_seneste uuid := private.seneste_saeson(p_kasse.id);
  v_medlem  uuid;
  v_skyldig int;
  v_betalt  int;
  v_dag     date;
  v_saeson  uuid;
  v_beloeb  int;
  v_id      uuid;
begin
  if not p_kasse.sen_betaling_til or p_dato < v_forste then return; end if;

  for v_medlem in
    select m.id from public.medlem m
     where m.bodekasse_id = p_kasse.id and (m.udmeldt is null or m.udmeldt > p_nu)
     order by m.id
  loop
    v_skyldig := private.skyldig(v_medlem, v_maaned);
    continue when v_skyldig <= 0;

    for v_dag in select d::date from generate_series(v_forste, p_dato, interval '1 day') d loop
      continue when exists (select 1 from public.gebyr
                             where medlem_id = v_medlem and art = 'sen_betaling' and udloeser = v_dag);
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
end $$;

-- After Catch-up (10) and Tilbagevendende (20): owed includes the Catch-up
-- dated to the end of last month.
insert into private.automatik_trin (navn, funktion, raekkefoelge)
values ('sen_betaling', 'private.automatik_sen_betaling', 30)
on conflict (navn) do nothing;

-- ---------- annuller_gebyr (from 20261101170100_automatik_catch_up.sql) ----------
-- As before, plus: a late-day Gebyr can be annulled on its own, by an Admin
-- or a Kasserer (private.mine_penge). Every other kind stays Admin-only. The
-- unique index keeps the annulled row, so that day is never charged again.
-- The feed entry's `navn` is null for a Catch-up or a late day.
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
  if v_gebyr.art = 'sen_betaling' then
    v_mig := private.mine_penge(v_gebyr.bodekasse_id);
  else
    v_mig := private.mit_admin(v_gebyr.bodekasse_id);
  end if;
  v_tidligere := private.start_kald(p_klient_id, 'annuller_gebyr');
  if v_tidligere is not null then return v_tidligere; end if;

  if v_gebyr.art not in ('oprettelse', 'anke', 'catch_up', 'sen_betaling') then
    raise exception 'kan_ikke_annulleres';
  end if;
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
