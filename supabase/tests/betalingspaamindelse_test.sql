-- Payment reminders (#83) through the automation function with an injected
-- "now". At 10:00 Copenhagen time, a Medlem who has paid less than they owed
-- gets one 'betalingspaamindelse' push 2 days before the Betalingsdag, on the
-- Betalingsdag and on each late day. Only in a box with Sen betaling on (it
-- owns the Betalingsdag), never in a Pause.
-- Summer time starts on Sunday 29 March 2026 (02:00 → 03:00).
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

-- A box whose first Sæson started on 1 January 2026, Sen betaling on or off,
-- with Betalingsdag p_dag.
create function tests.kasse_fra_januar(p_navn text, p_til boolean default true, p_dag int default 5)
returns uuid language plpgsql as $$
declare v_kasse uuid := tests.opret_bodekasse(p_navn);
begin
  update public.saeson set startet = '2026-01-01 00:00 Europe/Copenhagen' where bodekasse_id = v_kasse;
  update public.bodekasse set sen_betaling_til = p_til, betalingsdag = p_dag where id = v_kasse;
  return v_kasse;
end $$;

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

-- The reminders a box's Medlemmer got since the last call, as a test sees them.
create table tests.set_paamindelse (id bigint primary key);
create function tests.nye_paamindelser(p_kasse uuid)
returns table (navn text, titel text, tekst text, url text)
language plpgsql security definer as $$
begin
  return query
    select m.navn, u.titel, u.tekst, u.url
      from public.push_udbakke u
      join public.medlem m on m.user_id = u.user_id and m.bodekasse_id = u.bodekasse_id
     where u.art = 'betalingspaamindelse' and u.bodekasse_id = p_kasse
       and u.id not in (select s.id from tests.set_paamindelse s)
     order by u.id;
  insert into tests.set_paamindelse
    select u.id from public.push_udbakke u
     where u.art = 'betalingspaamindelse' and u.bodekasse_id = p_kasse
  on conflict do nothing;
end $$;

-- ---------- The three kinds of day, at 10:00 ----------
-- Betalingsdag 5. Bo owes 100 from January. Anna owes nothing. Cia owes but
-- turned reminders off. Dan owes but is Udmeldt.
select tests.kasse_fra_januar('Fodboldholdet') as kasse \gset
select tests.opret_medlem_med_login(:'kasse', 'Anna', true) as anna \gset
select tests.opret_medlem_med_login(:'kasse', 'Bo') as bo \gset
select tests.opret_medlem_med_login(:'kasse', 'Cia') as cia \gset
select tests.opret_medlem_med_login(:'kasse', 'Dan') as dan \gset
select tests.bode_givet(:'anna', :'bo', 100, '2026-01-20 20:00 Europe/Copenhagen');
select tests.bode_givet(:'anna', :'cia', 100, '2026-01-20 20:00 Europe/Copenhagen');
select tests.bode_givet(:'anna', :'dan', 100, '2026-01-20 20:00 Europe/Copenhagen');
update public.medlem set udmeldt = '2026-01-25 12:00 Europe/Copenhagen' where id = :'dan';
select tests.log_ind_som_medlem(:'cia');
select public.saet_push_praeference('betalingspaamindelse', false);
select tests.log_ud();

-- 3 February is 2 days before. Winter time: 10:00 in Copenhagen is 09:00 UTC.
select private.koer_automatik('2026-02-03 08:00+00');
select is_empty(format($$ select * from tests.nye_paamindelser(%L) $$, :'kasse'),
  'the 09:00 run sends no reminder');

select private.koer_automatik('2026-02-03 09:00+00');
select results_eq(
  format($$ select * from tests.nye_paamindelser(%L) $$, :'kasse'),
  format($$ values ('Bo', 'Betalingsdag om 2 dage i Fodboldholdet',
                    'Du mangler at betale 100 kr. Betal senest d. 5.',
                    '/profil?bodekasse=' || %L) $$, :'kasse'),
  '2 days before the Betalingsdag the 10:00 run reminds who owes; not the paid-up, the toggle-off or the Udmeldt');

select private.koer_automatik('2026-02-03 10:00+00');
select private.koer_automatik('2026-02-03 22:00+00');
select is_empty(format($$ select * from tests.nye_paamindelser(%L) $$, :'kasse'),
  'later runs the same day send nothing more');

select private.koer_automatik('2026-02-04 09:00+00');
select is_empty(format($$ select * from tests.nye_paamindelser(%L) $$, :'kasse'),
  'the day before the Betalingsdag is not a reminder day');

select private.koer_automatik('2026-02-05 09:00+00');
select results_eq(
  format($$ select * from tests.nye_paamindelser(%L) $$, :'kasse'),
  format($$ values ('Bo', 'Betalingsdag i dag i Fodboldholdet',
                    'Du mangler at betale 100 kr. Betal i dag, så undgår du gebyr for sen betaling.',
                    '/profil?bodekasse=' || %L) $$, :'kasse'),
  'on the Betalingsdag the 10:00 run reminds who owes');

-- 6 February is the first late day. Its 00:30 run charged the late fee,
-- which does not count towards what Bo must pay to stop the clock.
select private.koer_automatik('2026-02-05 23:30+00');
select private.koer_automatik('2026-02-06 09:00+00');
select results_eq(
  format($$ select * from tests.nye_paamindelser(%L) $$, :'kasse'),
  format($$ values ('Bo', 'Din betaling er forsinket i Fodboldholdet',
                    'Du mangler at betale 100 kr. Hver dag for sent koster et gebyr.',
                    '/profil?bodekasse=' || %L) $$, :'kasse'),
  'on a late day the 10:00 run reminds who is behind, with what is missing of last month''s debt');

select private.koer_automatik('2026-02-06 09:00+00');
select private.koer_automatik('2026-02-06 10:00+00');
select is(
  (select count(*)::int from public.push_udbakke
    where art = 'betalingspaamindelse' and bodekasse_id = :'kasse'),
  3,
  'running the same hour twice, and the next hour, writes no second reminder');

-- Bo pays 60 before 10:00 on the 7th; a missed 10:00 run is caught at 11:00.
select tests.indbetalt(:'bo', 60, '2026-02-07 08:00 Europe/Copenhagen');
select private.koer_automatik('2026-02-07 10:00+00');
select results_eq(
  format($$ select tekst from tests.nye_paamindelser(%L) $$, :'kasse'),
  $$ values ('Du mangler at betale 40 kr. Hver dag for sent koster et gebyr.') $$,
  'each late day reminds again, with the rest after a part payment; a later run catches a missed 10:00');

-- Bo pays the rest: no more reminders.
select tests.indbetalt(:'bo', 40, '2026-02-08 09:30 Europe/Copenhagen');
select private.koer_automatik('2026-02-08 09:00+00');
select private.koer_automatik('2026-02-09 09:00+00');
select is_empty(format($$ select * from tests.nye_paamindelser(%L) $$, :'kasse'),
  'a Medlem who has paid what they owed gets no reminder');

-- Cia turns reminders back on: from the next reminder day she gets them.
select tests.log_ind_som_medlem(:'cia');
select public.saet_push_praeference('betalingspaamindelse', true);
select tests.log_ud();
select private.koer_automatik('2026-02-10 09:00+00');
select results_eq(
  format($$ select navn from tests.nye_paamindelser(%L) $$, :'kasse'),
  $$ values ('Cia') $$,
  'the toggle applies when the reminder is written');

-- ---------- Summer time ----------
-- Betalingsdag 27. 27 March is winter time (10:00 = 09:00 UTC); 29 March,
-- a late day, is the first day of summer time (10:00 = 08:00 UTC).
select tests.kasse_fra_januar('Sommerholdet', true, 27) as sommer \gset
select tests.opret_medlem_med_login(:'sommer', 'Eva', true) as eva \gset
select tests.opret_medlem_med_login(:'sommer', 'Finn') as finn \gset
select tests.bode_givet(:'eva', :'finn', 80, '2026-02-20 20:00 Europe/Copenhagen');

select private.koer_automatik('2026-03-27 08:00+00');
select is_empty(format($$ select * from tests.nye_paamindelser(%L) $$, :'sommer'),
  'winter time: the 08:00 UTC run is 09:00 in Copenhagen, too early');
select private.koer_automatik('2026-03-27 09:00+00');
select results_eq(
  format($$ select navn, titel from tests.nye_paamindelser(%L) $$, :'sommer'),
  $$ values ('Finn', 'Betalingsdag i dag i Sommerholdet') $$,
  'winter time: the 09:00 UTC run is 10:00 in Copenhagen');

select private.koer_automatik('2026-03-29 07:00+00');
select is_empty(format($$ select * from tests.nye_paamindelser(%L) $$, :'sommer'),
  'summer time: the 07:00 UTC run is 09:00 in Copenhagen, too early');
select private.koer_automatik('2026-03-29 08:00+00');
select results_eq(
  format($$ select navn, tekst from tests.nye_paamindelser(%L) $$, :'sommer'),
  $$ values ('Finn', 'Du mangler at betale 80 kr. Hver dag for sent koster et gebyr.') $$,
  'summer time: the 08:00 UTC run is 10:00 in Copenhagen');
select private.koer_automatik('2026-03-29 09:00+00');
select is_empty(format($$ select * from tests.nye_paamindelser(%L) $$, :'sommer'),
  'summer time: the next run sends no second reminder');

-- ---------- Betalingsdag 1: 2 days before falls in the month before ----------
select tests.kasse_fra_januar('Den første', true, 1) as forste \gset
select tests.opret_medlem_med_login(:'forste', 'Gro', true) as gro \gset
select tests.opret_medlem_med_login(:'forste', 'Hans') as hans \gset
select tests.bode_givet(:'gro', :'hans', 70, '2026-04-10 20:00 Europe/Copenhagen');

select private.koer_automatik('2026-04-29 08:00+00');
select results_eq(
  format($$ select navn, titel, tekst from tests.nye_paamindelser(%L) $$, :'forste'),
  $$ values ('Hans', 'Betalingsdag om 2 dage i Den første', 'Du mangler at betale 70 kr. Betal senest d. 1.') $$,
  '2 days before a Betalingsdag next month reminds about the Saldo so far');
select private.koer_automatik('2026-04-28 08:00+00');
select private.koer_automatik('2026-04-30 08:00+00');
select is_empty(format($$ select * from tests.nye_paamindelser(%L) $$, :'forste'),
  'the other days: no reminder when nothing was owed at the start of the month');
select private.koer_automatik('2026-05-01 08:00+00');
select results_eq(
  format($$ select navn, titel from tests.nye_paamindelser(%L) $$, :'forste'),
  $$ values ('Hans', 'Betalingsdag i dag i Den første') $$,
  'the 1st is the Betalingsdag');

-- ---------- No reminders in a Pause ----------
select tests.kasse_fra_januar('Pauseholdet') as pause \gset
select tests.opret_medlem_med_login(:'pause', 'Ida', true) as ida \gset
select tests.opret_medlem_med_login(:'pause', 'Jens') as jens \gset
select tests.bode_givet(:'ida', :'jens', 100, '2026-01-20 20:00 Europe/Copenhagen');
update public.saeson set afsluttet = '2026-02-01 00:00 Europe/Copenhagen' where bodekasse_id = :'pause';

select private.koer_automatik(d)
  from generate_series('2026-02-03 09:00+00'::timestamptz, '2026-02-08 09:00+00', interval '1 day') d;
select is_empty(format($$ select * from tests.nye_paamindelser(%L) $$, :'pause'),
  'no reminders in a Pause');

-- ---------- Sen betaling off ----------
-- The Betalingsdag belongs to Sen betaling; with it off there is no payment
-- day to remind about.
select tests.kasse_fra_januar('Uden regel', false) as uden \gset
select tests.opret_medlem_med_login(:'uden', 'Kim', true) as kim \gset
select tests.opret_medlem_med_login(:'uden', 'Lars') as lars \gset
select tests.bode_givet(:'kim', :'lars', 100, '2026-01-20 20:00 Europe/Copenhagen');

select private.koer_automatik(d)
  from generate_series('2026-02-03 09:00+00'::timestamptz, '2026-02-08 09:00+00', interval '1 day') d;
select is_empty(format($$ select * from tests.nye_paamindelser(%L) $$, :'uden'),
  'a box with Sen betaling off sends no reminders');

select * from finish();
rollback;
