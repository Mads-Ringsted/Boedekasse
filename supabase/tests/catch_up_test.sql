-- Catch-up (#78) through the automation function with an injected "now":
-- on the 1st (Europe/Copenhagen) the N Medlemmer with the lowest Sæson total
-- up to the end of last month pay the Catch-up Gebyr, ties at the Nth included.
begin;
\ir _hjaelpere.psql
select plan(20);

-- A Bøde given at a chosen time.
create function tests.bode_givet(p_giver uuid, p_modtager uuid, p_pris int, p_givet timestamptz)
returns uuid language plpgsql as $$
declare v_id uuid := tests.giv_bode(p_giver, p_modtager, p_pris);
begin
  update public.bode set givet = p_givet where id = v_id;
  return v_id;
end $$;

-- A box whose first Sæson started on 1 January 2026, with Catch-up on or off.
create function tests.kasse_fra_januar(p_navn text, p_catch_up boolean default true)
returns uuid language plpgsql as $$
declare v_kasse uuid := tests.opret_bodekasse(p_navn);
begin
  update public.saeson set startet = '2026-01-01 00:00 Europe/Copenhagen' where bodekasse_id = v_kasse;
  update public.bodekasse set catch_up_til = p_catch_up where id = v_kasse;
  return v_kasse;
end $$;

-- Who paid a Catch-up in a box, by name.
create function tests.catch_up_navne(p_kasse uuid)
returns setof text language sql as $$
  select m.navn from public.gebyr g join public.medlem m on m.id = g.medlem_id
   where g.bodekasse_id = p_kasse and g.art = 'catch_up' order by m.navn
$$;

-- ---------- A default box: Catch-up is off ----------
select tests.kasse_fra_januar('Standard', false) as std \gset
select tests.opret_medlem_med_login(:'std', 'Anna', true) as std_anna \gset
select tests.opret_medlem(:'std', 'Bo') as std_bo \gset
select tests.bode_givet(:'std_anna', :'std_anna', 50, '2026-02-10 12:00 Europe/Copenhagen');

select private.koer_automatik('2026-03-01 00:30 Europe/Copenhagen');
select is_empty($$ select 1 from public.gebyr where art = 'catch_up' $$,
  'with default settings no Catch-up arises on the 1st');

-- ---------- The N lowest pay, ties at the Nth included ----------
-- February totals: Anna 100, Bo 30, Cia 30, Dan 60, Eva 10. N = 2 (default):
-- Eva is lowest, Bo and Cia tie for 2nd, so all three pay.
select tests.kasse_fra_januar('Hovedkassen') as kasse \gset
select tests.opret_medlem_med_login(:'kasse', 'Anna', true) as anna \gset
select tests.opret_medlem(:'kasse', 'Bo') as bo \gset
select tests.opret_medlem(:'kasse', 'Cia') as cia \gset
select tests.opret_medlem(:'kasse', 'Dan') as dan \gset
select tests.opret_medlem(:'kasse', 'Eva') as eva \gset
select tests.bode_givet(:'bo', :'anna', 100, '2026-02-03 20:00 Europe/Copenhagen');
select tests.bode_givet(:'anna', :'bo', 30, '2026-02-10 20:00 Europe/Copenhagen');
select tests.bode_givet(:'anna', :'cia', 30, '2026-02-11 20:00 Europe/Copenhagen');
select tests.bode_givet(:'anna', :'dan', 60, '2026-02-12 20:00 Europe/Copenhagen');
select tests.bode_givet(:'anna', :'eva', 10, '2026-02-13 20:00 Europe/Copenhagen');
update public.bodekasse set catch_up_beloeb = 40 where id = :'kasse';

select private.koer_automatik('2026-03-01 00:30 Europe/Copenhagen');
select results_eq(format($$ select * from tests.catch_up_navne(%L) $$, :'kasse'),
  $$ values ('Bo'), ('Cia'), ('Eva') $$,
  'the N lowest by Sæson total pay Catch-up, and everyone tied with the Nth too');

select results_eq(
  format($$ select distinct beloeb, saeson_id, oprettet, annulleret
              from public.gebyr where bodekasse_id = %L and art = 'catch_up' $$, :'kasse'),
  format($$ values (40, %L::uuid, '2026-02-28 23:59:59.999999 Europe/Copenhagen'::timestamptz,
                    null::timestamptz) $$,
         (select id from public.saeson where bodekasse_id = :'kasse')),
  'Catch-up charges the amount set, in the running Sæson, dated to the last moment of last month');

select is((select saldo from public.medlem_saldo where medlem_id = :'eva'), 50,
  'Catch-up counts in Saldo at once');

select results_eq(
  format($$ select h.art, h.aktoer_id, h.ref_tabel, h.data->>'maaned', (h.data->>'beloeb')::int,
                   (h.data->>'total')::int, h.saeson_id
              from public.haendelse h where h.modtager_id = %L and h.art = 'catch_up' $$, :'eva'),
  format($$ values ('catch_up', null::uuid, 'gebyr', '2026-02-01', 40, 10, %L::uuid) $$,
         (select id from public.saeson where bodekasse_id = :'kasse')),
  'each Catch-up gets a feed entry from the system for the payer, naming the month and the total');

-- ---------- Idempotent ----------
select private.koer_automatik('2026-03-01 00:30 Europe/Copenhagen');
select private.koer_automatik('2026-03-01 05:00 Europe/Copenhagen');
select is((select count(*)::int from public.gebyr where bodekasse_id = :'kasse' and art = 'catch_up'), 3,
  'running again on the same day, or for the same now, charges nothing extra');
select is((select count(*)::int from public.haendelse where bodekasse_id = :'kasse' and art = 'catch_up'), 3,
  'and adds no feed entries');

select private.koer_automatik('2026-03-02 00:30 Europe/Copenhagen');
select private.koer_automatik('2026-03-31 21:30+00');   -- 23:30 on 31 March in Copenhagen
select is((select count(*)::int from public.gebyr where bodekasse_id = :'kasse' and art = 'catch_up'), 3,
  'Catch-up only runs on the 1st, by the Copenhagen calendar');

-- ---------- The next month: earlier Catch-ups count in the total ----------
-- End of March: Anna 100, Bo 70, Cia 70, Dan 60, Eva 50. Without the March 1
-- Catch-ups it would be Eva, Bo and Cia again.
update public.bodekasse set catch_up_beloeb = 45 where id = :'kasse';
select private.koer_automatik('2026-03-31 22:30+00');   -- 00:30 on 1 April (summer time)
select results_eq(
  format($$ select m.navn, g.beloeb, g.udloeser, g.oprettet
              from public.gebyr g join public.medlem m on m.id = g.medlem_id
             where g.bodekasse_id = %L and g.art = 'catch_up' and g.udloeser = '2026-03-01'
             order by m.navn $$, :'kasse'),
  $$ values ('Dan', 45, '2026-03-01'::date, '2026-03-31 23:59:59.999999+02'::timestamptz),
            ('Eva', 45, '2026-03-01'::date, '2026-03-31 23:59:59.999999+02'::timestamptz) $$,
  'on 1 April the total includes Gebyrer, earlier Catch-ups among them, and the amount is the one set now');
select is((select count(*)::int from public.gebyr
            where bodekasse_id = :'kasse' and art = 'catch_up' and beloeb = 40), 3,
  'earlier Catch-ups keep the amount they were charged with');

-- ---------- An annulled Catch-up is never charged again ----------
select tests.log_ind_som_medlem(:'anna');
select public.annuller_gebyr(gen_random_uuid(),
  (select id from public.gebyr where medlem_id = :'dan' and art = 'catch_up'), 'Dan var syg');
select tests.log_ud();
select is((select annulleret is not null from public.aktivitet
            where art = 'catch_up' and modtager_id = :'dan'), true,
  'an Admin can annul a Catch-up, and its feed entry shows it annulled');
select private.koer_automatik('2026-03-31 22:30+00');
select private.koer_automatik('2026-04-01 12:00 Europe/Copenhagen');
select results_eq(
  format($$ select count(*)::int, count(annulleret)::int from public.gebyr
             where medlem_id = %L and art = 'catch_up' $$, :'dan'),
  $$ values (1, 1) $$,
  'after the annulment later runs charge nothing again');

-- ---------- What the Sæson total counts ----------
-- N = 1. Ali 20 + a 30 kr Gebyr = 50. Bent 40 (an annulled 100 kr Bøde and a
-- Bøde after the cutoff don't count). Carl 45 (an annulled Gebyr doesn't count).
select tests.kasse_fra_januar('Totaler') as tot \gset
update public.bodekasse set catch_up_antal = 1 where id = :'tot';
select tests.opret_medlem(:'tot', 'Ali', null, true) as ali \gset
select tests.opret_medlem(:'tot', 'Bent') as bent \gset
select tests.opret_medlem(:'tot', 'Carl') as carl \gset
select (select id from public.saeson where bodekasse_id = :'tot') as tot_s \gset
select tests.opret_bodekategori(:'ali', 'For sent', 20) as kat \gset
select tests.bode_givet(:'bent', :'ali', 20, '2026-02-03 20:00 Europe/Copenhagen');
insert into public.gebyr (bodekasse_id, saeson_id, medlem_id, art, beloeb, bodekategori_id, oprettet)
values (:'tot', :'tot_s', :'ali', 'oprettelse', 30, :'kat', '2026-02-03 20:00 Europe/Copenhagen');
select tests.bode_givet(:'ali', :'bent', 40, '2026-02-04 20:00 Europe/Copenhagen');
select tests.bode_givet(:'ali', :'bent', 100, '2026-02-05 20:00 Europe/Copenhagen') as annulleret \gset
update public.bode set annulleret = now(), annulleret_af = :'ali' where id = :'annulleret';
select tests.bode_givet(:'ali', :'bent', 100, '2026-03-01 00:10 Europe/Copenhagen');
select tests.bode_givet(:'ali', :'carl', 45, '2026-02-06 20:00 Europe/Copenhagen');
insert into public.gebyr (bodekasse_id, saeson_id, medlem_id, art, beloeb, bodekategori_id, oprettet,
                          annulleret, annulleret_af)
values (:'tot', :'tot_s', :'carl', 'oprettelse', 100, :'kat', '2026-02-06 20:00 Europe/Copenhagen',
        now(), :'ali');

select private.koer_automatik('2026-03-01 00:30 Europe/Copenhagen');
select results_eq(format($$ select * from tests.catch_up_navne(%L) $$, :'tot'),
  $$ values ('Bent') $$,
  'the total counts Bøder borne and Gebyrer up to last month''s end, without Annullerede ones');

-- ---------- Udmeldte Medlemmer are skipped ----------
select tests.kasse_fra_januar('Udmeldt') as udm \gset
update public.bodekasse set catch_up_antal = 1 where id = :'udm';
select tests.opret_medlem(:'udm', 'Ole', null, true) as ole \gset
select tests.opret_medlem(:'udm', 'Pia') as pia \gset
select tests.opret_medlem(:'udm', 'Rie') as rie \gset
select tests.bode_givet(:'pia', :'ole', 30, '2026-02-10 20:00 Europe/Copenhagen');
select tests.bode_givet(:'ole', :'rie', 60, '2026-02-10 20:00 Europe/Copenhagen');
update public.medlem set udmeldt = '2026-02-20 12:00 Europe/Copenhagen' where id = :'pia';

select private.koer_automatik('2026-03-01 00:30 Europe/Copenhagen');
select results_eq(format($$ select * from tests.catch_up_navne(%L) $$, :'udm'),
  $$ values ('Ole') $$,
  'an Udmeldt Medlem neither pays nor counts in the ranking');

-- ---------- No run in a Pause, or across a Sæson change ----------
-- Each box has one Medlem with nothing, who would pay if it ran.
select tests.kasse_fra_januar('Slut i februar') as slut \gset
select tests.opret_medlem(:'slut', 'Sif', null, true);
update public.saeson set slutdato = '2026-02-28' where bodekasse_id = :'slut';

select tests.kasse_fra_januar('Afsluttet') as afs \gset
select tests.opret_medlem(:'afs', 'Tom', null, true);
update public.saeson set afsluttet = '2026-02-15 12:00 Europe/Copenhagen' where bodekasse_id = :'afs';

select tests.kasse_fra_januar('Ny sæson') as ny \gset
select tests.opret_medlem(:'ny', 'Uffe', null, true);
update public.saeson set afsluttet = '2026-02-28 12:00 Europe/Copenhagen' where bodekasse_id = :'ny';
insert into public.saeson (bodekasse_id, navn, startet)
values (:'ny', 'Sæson 2', '2026-02-28 12:00 Europe/Copenhagen');

select tests.kasse_fra_januar('Slut i marts') as marts \gset
select tests.opret_medlem(:'marts', 'Vera', null, true);
update public.saeson set slutdato = '2026-03-01' where bodekasse_id = :'marts';

select private.koer_automatik('2026-03-01 00:30 Europe/Copenhagen');
select is_empty(format($$ select 1 from public.gebyr where art = 'catch_up' and bodekasse_id in (%L, %L) $$,
                       :'slut', :'afs'),
  'no Catch-up in a Pause on the 1st, so none when the Sæson ended with the month');
select is_empty(format($$ select 1 from public.gebyr where art = 'catch_up' and bodekasse_id = %L $$, :'ny'),
  'no Catch-up when a new Sæson started on the last day of the month');
select results_eq(format($$ select * from tests.catch_up_navne(%L) $$, :'marts'),
  $$ values ('Vera') $$,
  'a Sæson that runs on both the last day and the 1st gets its Catch-up');

-- ---------- Settings ----------
select tests.log_ind_som_medlem(:'std_anna');
select public.opdater_indstillinger(gen_random_uuid(), :'std',
  '{"catch_up_til": true, "catch_up_antal": 3, "catch_up_beloeb": 25}');
select results_eq(
  format($$ select catch_up_til, catch_up_antal, catch_up_beloeb from public.bodekasse where id = %L $$, :'std'),
  $$ values (true, 3, 25) $$,
  'an Admin switches Catch-up on and sets N and the amount');
select throws_ok(
  format($$ select public.opdater_indstillinger(gen_random_uuid(), %L, '{"catch_up_antal": 0}') $$, :'std'),
  'P0001', 'indstilling_ugyldig', 'N must be at least 1');
select tests.log_ud();

-- ---------- The hourly job ----------
select results_eq(
  $$ select schedule, command from cron.job where jobname = 'koer_automatik' $$,
  $$ values ('0 * * * *', 'select private.koer_automatik(now())') $$,
  'a pg_cron job calls the automation function with now() every hour');

select * from finish();
rollback;
