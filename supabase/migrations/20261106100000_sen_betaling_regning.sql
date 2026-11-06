-- Sen betaling gets kinder, after the first real month (November 2026):
-- Medlemmer paid on 31 October, got a Bøde that evening or a Catch-up dated
-- 23:59, and were charged every day for it.
--
-- 1. The bill for month M closes 2 days before M starts. Charges from the last
--    2 days of M−1 wait for the next month's bill, and that includes a
--    Catch-up, which is dated to the last moment of M−1. Money still counts up
--    to the start of M, so paying in those 2 days clears the bill.
-- 2. A late-day Gebyr comes at 09:00 Copenhagen time, not at midnight. Money in
--    before 09:00 on a day saves that day. The hourly job already runs on the
--    hour, so the schedule stays.
--
-- Payment reminders read the same private.skyldig, so they follow. The
-- reminder 2 days before a Betalingsdag on the 1st now shows the final amount.
-- Days already charged stay as they are: the unique index blocks a new charge.

-- ---------- When the bill closes and when the fee comes ----------

-- The moment the bill for month p_maaned (any day in it) closes.
create function private.regning_lukker(p_maaned date) returns timestamptz
language sql immutable set search_path = '' as $$
  select private.lokal_tid(date_trunc('month', p_maaned)::date - 2)
$$;

-- The moment a late-day Gebyr for p_dag is due, and dated to.
create function private.sen_betaling_tid(p_dag date) returns timestamptz
language sql immutable set search_path = '' as $$
  select private.lokal_tid(p_dag, '09:00')
$$;

revoke execute on function private.regning_lukker(date) from public, anon, authenticated;
revoke execute on function private.sen_betaling_tid(date) from public, anon, authenticated;

-- ---------- skyldig (from 20261101200000_sen_betaling.sql) ----------
-- owed(M): Bøder they bear and non-annulled Gebyrer from before the bill
-- closed, minus money in before the start of M. Negative = paid ahead.
create or replace function private.skyldig(p_medlem uuid, p_maaned date)
returns int
language sql stable security definer set search_path = '' as $$
  with t as (select private.regning_lukker(p_maaned) as lukker,
                    private.lokal_tid(date_trunc('month', p_maaned)::date) as maaned_start)
  select ( coalesce((select sum(b.pris) from public.bode_baerer b, t
                      where b.baerer_id = p_medlem and b.givet < t.lukker), 0)
         + coalesce((select sum(g.beloeb) from public.gebyr g, t
                      where g.medlem_id = p_medlem and g.annulleret is null
                        and g.oprettet < t.lukker), 0)
         - private.penge_ind(p_medlem, '-infinity', (select maaned_start from t))
         )::int
$$;

-- ---------- The step (from 20261102000000_spec74_review.sql) ----------
-- As before, with one moment per late day, private.sen_betaling_tid: today
-- waits until it has passed, and the Sæson, the active check, paid and the
-- Gebyr's date all use it.
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
  v_tid     timestamptz;
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
      v_til := case when p_nu < private.sen_betaling_tid(p_dato) then p_dato - 1 else p_dato end;
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
        v_tid := private.sen_betaling_tid(v_dag);
        v_saeson := private.saeson_paa(p_kasse.id, v_tid);
        continue when v_saeson is null or v_saeson is distinct from v_seneste;
        continue when not private.medlem_aktiv_paa(v_medlem, v_tid);
        v_betalt := private.betalt(v_medlem, v_maaned, v_tid);
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
        values (p_kasse.id, v_saeson, v_medlem, 'sen_betaling', v_beloeb, v_dag, v_tid)
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
