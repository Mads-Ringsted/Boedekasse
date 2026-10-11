-- Indstillinger: only an Admin changes a box's settings. A change only
-- touches the keys sent, and never charges or refunds anything already done.
begin;
\ir _hjaelpere.psql
select plan(14);

select tests.opret_bodekasse('Kasse A') as kasse \gset
select tests.opret_medlem_med_login(:'kasse', 'Mads', true) as admin \gset
select tests.opret_medlem_med_login(:'kasse', 'Jonas') as jonas \gset

-- ---------- Defaults ----------
select results_eq(
  format($$ select oprettelsesgebyr_til, oprettelsesgebyr, mobilepay_box from public.bodekasse where id = %L $$, :'kasse'),
  $$ values (false, 25, null::text) $$,
  'a new box has the creation Gebyr off at 25 kr and no MobilePay Box');

-- ---------- Admin ----------
select tests.log_ind_som_medlem(:'admin');
select is(
  public.opdater_indstillinger(gen_random_uuid(), :'kasse',
    '{"oprettelsesgebyr_til": true, "oprettelsesgebyr": 30}'),
  '{}'::jsonb,
  'an Admin changes settings');

select results_eq(
  format($$ select oprettelsesgebyr_til, oprettelsesgebyr, navn from public.bodekasse where id = %L $$, :'kasse'),
  $$ values (true, 30, 'Kasse A') $$,
  'only the keys sent change');

select public.opdater_indstillinger(gen_random_uuid(), :'kasse',
  '{"navn": "  FC Ølhunde  ", "mobilepay_box": " 1234   5678 "}');
select results_eq(
  format($$ select navn, mobilepay_box from public.bodekasse where id = %L $$, :'kasse'),
  $$ values ('FC Ølhunde', '1234 5678') $$,
  'the name is trimmed; the MobilePay Box number is trimmed with single spaces');

select public.opdater_indstillinger(gen_random_uuid(), :'kasse', '{"mobilepay_box": "  "}');
select is((select mobilepay_box from public.bodekasse where id = :'kasse'), null,
  'an empty MobilePay Box number removes it');

select throws_ok(
  format($$ select public.opdater_indstillinger(gen_random_uuid(), %L, '{"navn": " "}') $$, :'kasse'),
  'P0001', 'navn_mangler', 'the box name is required');

select throws_ok(
  format($$ select public.opdater_indstillinger(gen_random_uuid(), %L, '{"mobilepay_box": "12ab"}') $$, :'kasse'),
  'P0001', 'mobilepay_ugyldig', 'a MobilePay Box number is digits only');

select throws_ok(
  format($$ select public.opdater_indstillinger(gen_random_uuid(), %L, '{"oprettelsesgebyr": 0}') $$, :'kasse'),
  'P0001', 'indstilling_ugyldig', 'a Gebyr amount must be above 0 kr');

select throws_ok(
  format($$ select public.opdater_indstillinger(gen_random_uuid(), %L, '{"oprettelsesgebyr": "mange"}') $$, :'kasse'),
  'P0001', 'indstilling_ugyldig', 'a Gebyr amount must be a whole number');

select throws_ok(
  format($$ select public.opdater_indstillinger(gen_random_uuid(), %L, '{"oprettelsesgebyr_til": null}') $$, :'kasse'),
  'P0001', 'indstilling_ugyldig', 'a switch cannot be emptied');

select throws_ok(
  format($$ select public.opdater_indstillinger(gen_random_uuid(), %L, '{"id": "%s"}') $$, :'kasse', gen_random_uuid()),
  'P0001', 'indstilling_ukendt', 'only settings can be changed');

select is((select oprettelsesgebyr from public.bodekasse where id = :'kasse'), 30,
  'a rejected change leaves the settings as they were');

-- ---------- Not an Admin ----------
select tests.log_ind_som_medlem(:'jonas');
select throws_ok(
  format($$ select public.opdater_indstillinger(gen_random_uuid(), %L, '{"oprettelsesgebyr_til": false}') $$, :'kasse'),
  '42501', 'ikke_admin', 'a Medlem who is not Admin cannot change settings');

select tests.log_ud();
select is((select oprettelsesgebyr_til from public.bodekasse where id = :'kasse'), true,
  'the non-Admin''s attempt changed nothing');

select * from finish();
rollback;
