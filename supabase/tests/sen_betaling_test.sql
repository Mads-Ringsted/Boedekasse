-- Sen betaling (#80) through the automation function with an injected "now".
-- For month M: owed = charges from before the last 2 days of M−1, minus money
-- in before M; paid = what came in from the start of M (Indbetalinger, pending
-- Betalingsmeldinger by report time). Each day D after the Betalingsdag, in a
-- running Sæson, with owed > 0 and paid by 09:00 on D < owed, gets one
-- late-day Gebyr at 09:00.
begin;
\ir _hjaelpere.psql
select plan(39);

-- A Bøde given at a chosen time.
create function tests.bode_givet(p_giver uuid, p_modtager uuid, p_pris int, p_givet timestamptz)
returns uuid language plpgsql as $$
declare v_id uuid := tests.giv_bode(p_giver, p_modtager, p_pris);
begin
  update public.bode set givet = p_givet where id = v_id;
  return v_id;
end $$;

-- A box whose first Sæson started on 1 January 2026, with Sen betaling on
-- (Betalingsdag p_dag, 25 kr a day) or off.
create function tests.kasse_fra_januar(p_navn text, p_til boolean default true, p_dag int default 1)
returns uuid language plpgsql as $$
declare v_kasse uuid := tests.opret_bodekasse(p_navn);
begin
  update public.saeson set startet = '2026-01-01 00:00 Europe/Copenhagen' where bodekasse_id = v_kasse;
  update public.bodekasse set sen_betaling_til = p_til, betalingsdag = p_dag, sen_betaling_beloeb = 25
   where id = v_kasse;
  return v_kasse;
end $$;

-- The late days a Medlem was charged, in order.
create function tests.sene_dage(p_medlem uuid)
returns setof date language sql as $$
  select udloeser from public.gebyr where medlem_id = p_medlem and art = 'sen_betaling' order by udloeser
$$;

-- An Indbetaling registered at a chosen time.
create function tests.indbetalt(p_medlem uuid, p_beloeb int, p_tid timestamptz)
returns uuid language plpgsql as $$
declare v_id uuid;
begin
  insert into public.indbetaling (bodekasse_id, saeson_id, medlem_id, beloeb, registreret_af, registreret)
  select m.bodekasse_id, private.seneste_saeson(m.bodekasse_id), m.id, p_beloeb, m.id, p_tid
    from public.medlem m where m.id = p_medlem
  returning id into v_id;
  return v_id;
end $$;

-- ---------- A default box: Sen betaling is off ----------
select tests.kasse_fra_januar('Standard', false) as std \gset
select tests.opret_medlem_med_login(:'std', 'Anna', true) as std_anna \gset
select tests.opret_medlem(:'std', 'Bo') as std_bo \gset
select tests.bode_givet(:'std_anna', :'std_bo', 50, '2026-01-10 12:00 Europe/Copenhagen');

select private.koer_automatik('2026-02-10 09:00 Europe/Copenhagen');
select is_empty($$ select 1 from public.gebyr where art = 'sen_betaling' $$,
  'with default settings no Sen betaling arises');

-- ---------- One Gebyr per late day ----------
-- Betalingsdag 5. Bo owes 100 from January; Anna owes nothing.
select tests.kasse_fra_januar('Grund', true, 5) as kasse \gset
select tests.opret_medlem_med_login(:'kasse', 'Anna', true) as anna \gset
select tests.opret_medlem(:'kasse', 'Bo') as bo \gset
select (select id from public.saeson where bodekasse_id = :'kasse') as kasse_s \gset
select tests.bode_givet(:'anna', :'bo', 100, '2026-01-20 20:00 Europe/Copenhagen');

select private.koer_automatik('2026-02-05 23:30 Europe/Copenhagen');
select is_empty(format($$ select 1 from public.gebyr where bodekasse_id = %L and art = 'sen_betaling' $$, :'kasse'),
  'nothing is charged on or before the Betalingsdag');

select private.koer_automatik('2026-02-06 08:00 Europe/Copenhagen');
select is_empty(format($$ select 1 from public.gebyr where bodekasse_id = %L and art = 'sen_betaling' $$, :'kasse'),
  'a late day is not charged before 09:00');

select private.koer_automatik('2026-02-06 09:00 Europe/Copenhagen');
select results_eq(
  format($$ select medlem_id, beloeb, udloeser, saeson_id, oprettet, annulleret
              from public.gebyr where bodekasse_id = %L and art = 'sen_betaling' $$, :'kasse'),
  format($$ values (%L::uuid, 25, '2026-02-06'::date, %L::uuid,
                    '2026-02-06 09:00 Europe/Copenhagen'::timestamptz, null::timestamptz) $$,
         :'bo', :'kasse_s'),
  'the first day after the Betalingsdag charges the amount set, dated to 09:00 that day, only to who owes');

select results_eq(
  format($$ select h.aktoer_id, h.ref_tabel, h.ref_id, h.data->>'dag', (h.data->>'beloeb')::int,
                   (h.data->>'skyldig')::int, (h.data->>'betalt')::int, h.saeson_id
              from public.haendelse h where h.modtager_id = %L and h.art = 'sen_betaling' $$, :'bo'),
  format($$ values (null::uuid, 'gebyr', %L::uuid, '2026-02-06', 25, 100, 0, %L::uuid) $$,
         (select id from public.gebyr where medlem_id = :'bo' and art = 'sen_betaling'), :'kasse_s'),
  'each late day gets a feed entry from the system for the payer, naming the day, owed and paid');

-- Idempotent: the same now, or later on the same day, charges nothing extra.
select private.koer_automatik('2026-02-06 09:00 Europe/Copenhagen');
select private.koer_automatik('2026-02-06 18:00 Europe/Copenhagen');
select is((select count(*)::int from public.gebyr where medlem_id = :'bo' and art = 'sen_betaling'), 1,
  'running again on the same day charges nothing extra');

-- A missed run: the next run charges every late day up to today.
select private.koer_automatik('2026-02-08 09:00 Europe/Copenhagen');
select results_eq(format($$ select * from tests.sene_dage(%L) $$, :'bo'),
  $$ values ('2026-02-06'::date), ('2026-02-07'), ('2026-02-08') $$,
  'after missed runs, the next run charges each late day once');

-- A part payment doesn't stop the clock; the rest does from the next day.
select tests.indbetalt(:'bo', 60, '2026-02-08 15:00 Europe/Copenhagen');
select private.koer_automatik('2026-02-09 09:00 Europe/Copenhagen');
select tests.indbetalt(:'bo', 40, '2026-02-09 10:00 Europe/Copenhagen');
select private.koer_automatik('2026-02-10 09:00 Europe/Copenhagen');
select private.koer_automatik('2026-02-28 12:00 Europe/Copenhagen');
select results_eq(format($$ select * from tests.sene_dage(%L) $$, :'bo'),
  $$ values ('2026-02-06'::date), ('2026-02-07'), ('2026-02-08'), ('2026-02-09') $$,
  'paid by 09:00 on D must reach owed; late fees this month don''t count towards owed');

-- March: owed is the Saldo at the end of February, February's late fees included.
select is((select saldo from public.medlem_saldo where medlem_id = :'bo'), 100,
  'the late fees count in Saldo at once');
select private.koer_automatik('2026-03-06 09:00 Europe/Copenhagen');
select results_eq(
  format($$ select udloeser, (select (data->>'skyldig')::int from public.haendelse where ref_id = g.id)
              from public.gebyr g where medlem_id = %L and art = 'sen_betaling' and udloeser >= '2026-03-01' $$,
         :'bo'),
  $$ values ('2026-03-06'::date, 100) $$,
  'late fees charged in February are part of what is owed for March');

-- ---------- Betalingsmeldinger ----------
-- Betalingsdag 1. Cia owes 50. She reports 50 on 3 Feb at 15:00.
select tests.kasse_fra_januar('Meldinger') as mk \gset
select tests.opret_medlem_med_login(:'mk', 'Ida', true) as ida \gset
select tests.opret_medlem_med_login(:'mk', 'Cia') as cia \gset
select tests.bode_givet(:'ida', :'cia', 50, '2026-01-20 20:00 Europe/Copenhagen');
insert into public.betalingsmelding (bodekasse_id, saeson_id, medlem_id, beloeb, meldt)
values (:'mk', private.seneste_saeson(:'mk'), :'cia', 50, '2026-02-03 15:00 Europe/Copenhagen')
returning id as melding \gset

select private.koer_automatik('2026-02-04 09:00 Europe/Copenhagen');
select private.koer_automatik('2026-02-06 09:00 Europe/Copenhagen');
select results_eq(format($$ select * from tests.sene_dage(%L) $$, :'cia'),
  $$ values ('2026-02-02'::date), ('2026-02-03') $$,
  'a pending Betalingsmelding counts as paid from when it was reported');

select tests.log_ind_som_medlem(:'ida');
select public.behandl_betalingsmelding(gen_random_uuid(), :'melding', false);
select tests.log_ud();
select private.koer_automatik('2026-02-06 12:00 Europe/Copenhagen');
select results_eq(format($$ select * from tests.sene_dage(%L) $$, :'cia'),
  $$ values ('2026-02-02'::date), ('2026-02-03'), ('2026-02-04'), ('2026-02-05'), ('2026-02-06') $$,
  'after a rejection the next run back-charges the missed days');

-- A new report, confirmed later: the Indbetaling counts from the report time.
insert into public.betalingsmelding (bodekasse_id, saeson_id, medlem_id, beloeb, meldt)
values (:'mk', private.seneste_saeson(:'mk'), :'cia', 50, '2026-02-06 13:00 Europe/Copenhagen')
returning id as melding2 \gset
select tests.log_ind_som_medlem(:'ida');
select public.behandl_betalingsmelding(gen_random_uuid(), :'melding2', true);
select tests.log_ud();
select private.koer_automatik('2026-02-12 09:00 Europe/Copenhagen');
select is((select count(*)::int from public.gebyr where medlem_id = :'cia' and art = 'sen_betaling'), 5,
  'a confirmed Betalingsmelding counts by its original report time');

-- ---------- An annulled Indbetaling back-charges ----------
select tests.kasse_fra_januar('Annulleret indbetaling') as ai \gset
select tests.opret_medlem(:'ai', 'Dan', null, true) as dan \gset
select tests.bode_givet(:'dan', :'dan', 30, '2026-01-20 20:00 Europe/Copenhagen');
select tests.indbetalt(:'dan', 30, '2026-02-01 09:00 Europe/Copenhagen') as dan_ind \gset
select private.koer_automatik('2026-02-04 12:00 Europe/Copenhagen');
select is_empty(format($$ select 1 from public.gebyr where medlem_id = %L and art = 'sen_betaling' $$, :'dan'),
  'a Medlem who paid what they owed is not charged');
update public.indbetaling set annulleret = now(), annulleret_af = :'dan' where id = :'dan_ind';
select private.koer_automatik('2026-02-04 13:00 Europe/Copenhagen');
select results_eq(format($$ select * from tests.sene_dage(%L) $$, :'dan'),
  $$ values ('2026-02-02'::date), ('2026-02-03'), ('2026-02-04') $$,
  'after an Indbetaling is annulled the next run back-charges the missed days');

-- Paying before 09:00 on a late day saves that day; paying after it doesn't.
select tests.kasse_fra_januar('Morgenbetaling') as mb \gset
select tests.opret_medlem(:'mb', 'Tom', null, true) as tom \gset
select tests.opret_medlem(:'mb', 'Ulla') as ulla \gset
select tests.bode_givet(:'tom', :'tom', 30, '2026-01-20 20:00 Europe/Copenhagen');
select tests.bode_givet(:'tom', :'ulla', 30, '2026-01-20 20:00 Europe/Copenhagen');
select tests.indbetalt(:'tom', 30, '2026-02-02 08:30 Europe/Copenhagen');
select tests.indbetalt(:'ulla', 30, '2026-02-02 09:30 Europe/Copenhagen');
select private.koer_automatik('2026-02-04 12:00 Europe/Copenhagen');
select is_empty(format($$ select 1 from public.gebyr where medlem_id = %L and art = 'sen_betaling' $$, :'tom'),
  'money in before 09:00 on a late day stops that day''s Gebyr');
select results_eq(format($$ select * from tests.sene_dage(%L) $$, :'ulla'),
  $$ values ('2026-02-02'::date) $$,
  'money in after 09:00 stops the Gebyr from the next day');

-- ---------- The last 2 days of a month carry over ----------
-- Vera pays all she owes on 31 January, then gets a Bøde that evening. It
-- waits for March's bill, so February has no late fee. Wes's Bøde comes just
-- before the bill closes on 30 January, so it is on February's bill.
select tests.kasse_fra_januar('Sidste dage') as sd \gset
select tests.opret_medlem(:'sd', 'Vera', null, true) as vera \gset
select tests.opret_medlem(:'sd', 'Wes') as wes \gset
select tests.bode_givet(:'vera', :'vera', 100, '2026-01-20 20:00 Europe/Copenhagen');
select tests.indbetalt(:'vera', 100, '2026-01-31 12:00 Europe/Copenhagen');
select tests.bode_givet(:'wes', :'vera', 40, '2026-01-31 22:50 Europe/Copenhagen');
select tests.bode_givet(:'vera', :'wes', 40, '2026-01-29 23:59 Europe/Copenhagen');
select private.koer_automatik('2026-02-04 12:00 Europe/Copenhagen');
select is_empty(format($$ select 1 from public.gebyr where medlem_id = %L and art = 'sen_betaling' $$, :'vera'),
  'a Bøde in the last 2 days of the month is not on the next bill');
select results_eq(format($$ select * from tests.sene_dage(%L) $$, :'wes'),
  $$ values ('2026-02-02'::date), ('2026-02-03'), ('2026-02-04') $$,
  'a Bøde from before the last 2 days of the month is on the bill');
select is(private.skyldig(:'vera', '2026-03-01'), 40,
  'a Bøde carried over is on the following month''s bill');

-- Money paid in January lowers what is owed for February.
select tests.kasse_fra_januar('Betalt i januar') as bj \gset
select tests.opret_medlem(:'bj', 'Eli', null, true) as eli \gset
select tests.bode_givet(:'eli', :'eli', 30, '2026-01-20 20:00 Europe/Copenhagen');
select tests.indbetalt(:'eli', 50, '2026-01-25 09:00 Europe/Copenhagen');
select tests.bode_givet(:'eli', :'eli', 80, '2026-02-01 20:00 Europe/Copenhagen');
select private.koer_automatik('2026-02-10 12:00 Europe/Copenhagen');
select is_empty(format($$ select 1 from public.gebyr where medlem_id = %L and art = 'sen_betaling' $$, :'eli'),
  'no late fee when owed at the end of last month is 0 or less, whatever arose since');

-- ---------- A Catch-up waits for the next bill ----------
select tests.kasse_fra_januar('Med catch-up') as mc \gset
update public.bodekasse set catch_up_til = true, catch_up_antal = 1, catch_up_beloeb = 50 where id = :'mc';
select tests.opret_medlem(:'mc', 'Lea', null, true) as lea \gset
select private.koer_automatik('2026-02-01 09:00 Europe/Copenhagen');
select private.koer_automatik('2026-02-02 09:00 Europe/Copenhagen');
select is_empty(format($$ select 1 from public.gebyr where medlem_id = %L and art = 'sen_betaling' $$, :'lea'),
  'a Catch-up on the 1st is not on the bill due that same day');
select private.koer_automatik('2026-03-01 00:30 Europe/Copenhagen');
select private.koer_automatik('2026-03-02 09:00 Europe/Copenhagen');
select results_eq(
  format($$ select g.udloeser, (h.data->>'skyldig')::int from public.gebyr g
              join public.haendelse h on h.ref_id = g.id
             where g.medlem_id = %L and g.art = 'sen_betaling' $$, :'lea'),
  $$ values ('2026-03-02'::date, 50) $$,
  'a Catch-up is on the bill of the month after it');

-- ---------- The monthly cap ----------
-- 25 kr a day, at most 60 kr a month: 25 + 25 + 10.
select tests.kasse_fra_januar('Loft') as loft \gset
update public.bodekasse set sen_betaling_loft = 60 where id = :'loft';
select tests.opret_medlem(:'loft', 'Fia', null, true) as fia \gset
select tests.bode_givet(:'fia', :'fia', 10, '2026-01-20 20:00 Europe/Copenhagen');
select private.koer_automatik('2026-02-10 12:00 Europe/Copenhagen');
select results_eq(
  format($$ select udloeser, beloeb from public.gebyr where medlem_id = %L and art = 'sen_betaling'
             order by udloeser $$, :'fia'),
  $$ values ('2026-02-02'::date, 25), ('2026-02-03', 25), ('2026-02-04', 10) $$,
  'with a cap the late fees for a month never go above it');

-- ---------- Annulling a late day: Admin or Kasserer ----------
select tests.kasse_fra_januar('Annullering') as an \gset
select tests.opret_medlem_med_login(:'an', 'Ole', true) as ole \gset
select tests.opret_medlem_med_login(:'an', 'Kim') as kim \gset
select tests.opret_medlem_med_login(:'an', 'Lis') as lis \gset
update public.medlem set er_kasserer = true where id = :'kim';
select tests.bode_givet(:'ole', :'lis', 20, '2026-01-20 20:00 Europe/Copenhagen');
select private.koer_automatik('2026-02-03 09:00 Europe/Copenhagen');
select id as lis_dag2 from public.gebyr where medlem_id = :'lis' and udloeser = '2026-02-02' \gset

select tests.log_ind_som_medlem(:'lis');
select throws_ok(format($$ select public.annuller_gebyr(gen_random_uuid(), %L) $$, :'lis_dag2'),
  '42501', 'ikke_kasserer', 'a plain Medlem can''t annul a late day');
select tests.log_ind_som_medlem(:'kim');
select public.annuller_gebyr(gen_random_uuid(), :'lis_dag2', 'Glemt');
select tests.log_ud();
select is((select annulleret is not null from public.aktivitet where art = 'sen_betaling' and ref_id = :'lis_dag2'),
  true, 'a Kasserer annuls a single late day, and its feed entry shows it annulled');

select private.koer_automatik('2026-02-03 12:00 Europe/Copenhagen');
select private.koer_automatik('2026-02-04 09:00 Europe/Copenhagen');
select results_eq(
  format($$ select udloeser, annulleret is not null from public.gebyr
             where medlem_id = %L and art = 'sen_betaling' order by udloeser $$, :'lis'),
  $$ values ('2026-02-02'::date, true), ('2026-02-03', false), ('2026-02-04', false) $$,
  'an annulled late day is never charged again');

insert into public.gebyr (bodekasse_id, saeson_id, medlem_id, art, beloeb, udloeser, oprettet)
values (:'an', private.seneste_saeson(:'an'), :'lis', 'catch_up', 50, '2026-01-01',
        '2026-01-31 23:59 Europe/Copenhagen')
returning id as lis_catch_up \gset
select tests.log_ind_som_medlem(:'kim');
select throws_ok(format($$ select public.annuller_gebyr(gen_random_uuid(), %L) $$, :'lis_catch_up'),
  '42501', 'ikke_admin', 'other Gebyrer stay Admin-only');
select tests.log_ud();

-- ---------- No late fees in a Pause ----------
select tests.kasse_fra_januar('Slut 4. februar') as slut \gset
update public.saeson set slutdato = '2026-02-04' where bodekasse_id = :'slut';
select tests.opret_medlem(:'slut', 'Gus', null, true) as gus \gset
select tests.bode_givet(:'gus', :'gus', 20, '2026-01-20 20:00 Europe/Copenhagen');
select private.koer_automatik('2026-02-10 12:00 Europe/Copenhagen');
select results_eq(format($$ select * from tests.sene_dage(%L) $$, :'gus'),
  $$ values ('2026-02-02'::date), ('2026-02-03'), ('2026-02-04') $$,
  'days after the Sæson ended are not charged');

select tests.kasse_fra_januar('Ny sæson 8. februar') as ny \gset
update public.saeson set afsluttet = '2026-01-31 12:00 Europe/Copenhagen' where bodekasse_id = :'ny';
select tests.opret_medlem(:'ny', 'Hans', null, true) as hans \gset
select tests.bode_givet(:'hans', :'hans', 20, '2026-01-20 20:00 Europe/Copenhagen');
insert into public.saeson (bodekasse_id, navn, startet)
values (:'ny', 'Sæson 2', '2026-02-08 12:00 Europe/Copenhagen') returning id as ny_s2 \gset
select private.koer_automatik('2026-02-10 12:00 Europe/Copenhagen');
select results_eq(
  format($$ select udloeser, saeson_id from public.gebyr where medlem_id = %L and art = 'sen_betaling'
             order by udloeser $$, :'hans'),
  format($$ values ('2026-02-09'::date, %1$L::uuid), ('2026-02-10', %1$L::uuid) $$, :'ny_s2'),
  'days in a Pause are skipped; days in the new Sæson are charged there');

-- ---------- Udmeldte Medlemmer ----------
select tests.kasse_fra_januar('Udmeldt') as udm \gset
select tests.opret_medlem(:'udm', 'Jon', null, true) as jon \gset
select tests.opret_medlem(:'udm', 'Kai') as kai \gset
select tests.bode_givet(:'jon', :'kai', 20, '2026-01-20 20:00 Europe/Copenhagen');
select tests.bode_givet(:'kai', :'jon', 20, '2026-01-20 20:00 Europe/Copenhagen');
update public.medlem set udmeldt = '2026-02-01 12:00 Europe/Copenhagen' where id = :'jon';
select private.koer_automatik('2026-02-03 09:00 Europe/Copenhagen');
-- Kai is udmeldt on 3 Feb at 12:00 and brought back on 6 Feb at 10:00. Like
-- udmeld and genoptag, each writes a feed entry.
update public.medlem set udmeldt = '2026-02-03 12:00 Europe/Copenhagen' where id = :'kai';
insert into public.haendelse (bodekasse_id, saeson_id, tid, art, modtager_id, ref_tabel, ref_id)
values (:'udm', private.seneste_saeson(:'udm'), '2026-02-03 12:00 Europe/Copenhagen',
        'medlem_udmeldt', :'kai', 'medlem', :'kai');
select private.koer_automatik('2026-02-05 09:00 Europe/Copenhagen');
update public.medlem set udmeldt = null where id = :'kai';
insert into public.haendelse (bodekasse_id, saeson_id, tid, art, modtager_id, ref_tabel, ref_id)
values (:'udm', private.seneste_saeson(:'udm'), '2026-02-06 10:00 Europe/Copenhagen',
        'medlem_genoptaget', :'kai', 'medlem', :'kai');
select private.koer_automatik('2026-02-08 09:00 Europe/Copenhagen');
select is_empty(format($$ select 1 from public.gebyr where medlem_id = %L and art = 'sen_betaling' $$, :'jon'),
  'an Udmeldt Medlem is not charged');
select results_eq(format($$ select * from tests.sene_dage(%L) $$, :'kai'),
  $$ values ('2026-02-02'::date), ('2026-02-03'), ('2026-02-07'), ('2026-02-08') $$,
  'a Medlem brought back is charged again from then, with nothing for the gap');

-- Spec #74: "A Medlem who is brought back is included again from that day,
-- with nothing charged for the gap." Only the gap: Mads was late from 21 Oct,
-- Udmeldt on 26 Oct at 12:00 and brought back on 28 Oct at 10:00, and no run
-- happened until 30 Oct. The days before he left are still back-charged.
select tests.kasse_fra_januar('Tilbage igen', true, 20) as tig \gset
select tests.opret_medlem(:'tig', 'Lone', null, true) as lone \gset
select tests.opret_medlem(:'tig', 'Mads') as mads \gset
select tests.bode_givet(:'lone', :'mads', 40, '2026-09-20 20:00 Europe/Copenhagen');
insert into public.haendelse (bodekasse_id, saeson_id, tid, art, modtager_id, ref_tabel, ref_id)
values (:'tig', private.seneste_saeson(:'tig'), '2026-10-26 12:00 Europe/Copenhagen',
        'medlem_udmeldt', :'mads', 'medlem', :'mads'),
       (:'tig', private.seneste_saeson(:'tig'), '2026-10-28 10:00 Europe/Copenhagen',
        'medlem_genoptaget', :'mads', 'medlem', :'mads');
select private.koer_automatik('2026-10-30 09:00 Europe/Copenhagen');
select results_eq(format($$ select * from tests.sene_dage(%L) $$, :'mads'),
  $$ values ('2026-10-21'::date), ('2026-10-22'), ('2026-10-23'), ('2026-10-24'), ('2026-10-25'),
            ('2026-10-26'), ('2026-10-29'), ('2026-10-30') $$,
  'a Medlem brought back is charged for the days before they left and from the day after they returned, not the gap');

-- ---------- A missed run across the month end (spec #74 review) ----------
-- Spec #74: "A missed run catches up on the next one." No run on 28 February;
-- the next is on 2 March. The last 7 local days reach back into February, so
-- 28 February is charged by February's rules. A box that switched Sen
-- betaling on on 1 March gets nothing for February.
select tests.kasse_fra_januar('Månedsskifte') as ms \gset
update public.bodekasse set sen_betaling_til_siden = '2026-01-01 00:00 Europe/Copenhagen' where id = :'ms';
select tests.opret_medlem(:'ms', 'Nis', null, true) as nis \gset
select tests.bode_givet(:'nis', :'nis', 20, '2026-01-20 20:00 Europe/Copenhagen');
select private.koer_automatik('2026-02-27 12:00 Europe/Copenhagen');
select private.koer_automatik('2026-03-02 09:00 Europe/Copenhagen');
select results_eq(
  format($$ select udloeser, oprettet from public.gebyr where medlem_id = %L and art = 'sen_betaling'
             and udloeser >= '2026-02-27' order by udloeser $$, :'nis'),
  $$ values ('2026-02-27'::date, '2026-02-27 09:00 Europe/Copenhagen'::timestamptz),
            ('2026-02-28', '2026-02-28 09:00 Europe/Copenhagen'),
            ('2026-03-02', '2026-03-02 09:00 Europe/Copenhagen') $$,
  'a missed last day of the month is caught up in the next month, dated to its own day');

select tests.kasse_fra_januar('Slået til 1. marts') as m1 \gset
update public.bodekasse set sen_betaling_til_siden = '2026-03-01 08:00 Europe/Copenhagen' where id = :'m1';
select tests.opret_medlem(:'m1', 'Ole', null, true) as m1_ole \gset
select tests.bode_givet(:'m1_ole', :'m1_ole', 20, '2026-01-20 20:00 Europe/Copenhagen');
select private.koer_automatik('2026-03-02 09:00 Europe/Copenhagen');
select results_eq(format($$ select * from tests.sene_dage(%L) $$, :'m1_ole'),
  $$ values ('2026-03-02'::date) $$,
  'days of last month before Sen betaling was switched on are not charged');

-- ---------- Settings ----------
select tests.log_ind_som_medlem(:'std_anna');
select public.opdater_indstillinger(gen_random_uuid(), :'std',
  '{"sen_betaling_til": true, "betalingsdag": 28, "sen_betaling_beloeb": 20, "sen_betaling_loft": 100}');
select results_eq(
  format($$ select sen_betaling_til, betalingsdag, sen_betaling_beloeb, sen_betaling_loft
              from public.bodekasse where id = %L $$, :'std'),
  $$ values (true, 28, 20, 100) $$,
  'an Admin switches Sen betaling on and sets the Betalingsdag, the amount per day and a cap');
select public.opdater_indstillinger(gen_random_uuid(), :'std', '{"sen_betaling_loft": null}');
select is((select sen_betaling_loft from public.bodekasse where id = :'std'), null,
  'the cap is optional');
select throws_ok(
  format($$ select public.opdater_indstillinger(gen_random_uuid(), %L, '{"betalingsdag": 29}') $$, :'std'),
  'P0001', 'indstilling_ugyldig', 'the Betalingsdag is 1–28');
select throws_ok(
  format($$ select public.opdater_indstillinger(gen_random_uuid(), %L, '{"sen_betaling_loft": 0}') $$, :'std'),
  'P0001', 'indstilling_ugyldig', 'a cap must be above 0');
select tests.log_ud();

select * from finish();
rollback;
