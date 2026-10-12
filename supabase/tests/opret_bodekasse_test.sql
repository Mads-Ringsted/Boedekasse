-- opret_bodekasse: a signed-in person creates a box with its name and their
-- own name, becomes its first Admin, and its first Sæson starts at once.
begin;
\ir _hjaelpere.psql
select plan(14);

select tests.opret_bruger('ny@test.dk') as ny \gset
select tests.opret_bruger('anden@test.dk') as anden \gset
select gen_random_uuid() as id1 \gset

select tests.log_ind_som(:'ny');
select public.opret_bodekasse(:'id1', '  Klassen fra 2012 ', ' Mads Ringsted ') as svar \gset
select (:'svar'::jsonb ->> 'bodekasse_id')::uuid as kasse \gset
select (:'svar'::jsonb ->> 'medlem_id')::uuid as mig \gset

select results_eq(
  format($$ select navn from public.bodekasse where id = %L $$, :'kasse'),
  $$ values ('Klassen fra 2012') $$,
  'the caller sees the new box, its name trimmed');

select results_eq(
  format($$ select id, navn, er_admin, email from public.medlem where bodekasse_id = %L $$, :'kasse'),
  format($$ values (%L::uuid, 'Mads Ringsted', true, 'ny@test.dk') $$, :'mig'),
  'the caller is its only Medlem, with their name, as Admin');

select results_eq(
  format($$ select m.bodekasse_id from public.medlem m where m.user_id = %L $$, :'ny'),
  format($$ values (%L::uuid) $$, :'kasse'),
  'the new Medlem is linked to the caller''s login');

select results_eq(
  format($$ select navn, koerer from public.saeson_status where bodekasse_id = %L $$, :'kasse'),
  format($$ values ('Sæson ' || extract(year from now() at time zone 'Europe/Copenhagen')::text, true) $$),
  'the first Sæson is "Sæson <year>" and running');

select results_eq(
  format($$ select pause from public.bodekasse_saeson where bodekasse_id = %L $$, :'kasse'),
  $$ values (false) $$,
  'the new box is not in a Pause');

select matches(
  (select kode from public.bodekasse_kode where bodekasse_id = :'kasse'),
  '^[A-Z0-9]{6}$',
  'the Admin can read the box''s new join code');

select results_eq(
  format($$ select art, aktoer_id from public.haendelse where bodekasse_id = %L $$, :'kasse'),
  format($$ values ('bodekasse_oprettet', %L::uuid) $$, :'mig'),
  'one feed entry: the caller created the box');

select results_eq(
  format($$ select beloeb from public.kassen where bodekasse_id = %L $$, :'kasse'),
  $$ values (0) $$,
  'the box starts at 0 kr');

-- Prøv igen with the same one-time ID: same answer, nothing new.
select is(public.opret_bodekasse(:'id1', 'Klassen fra 2012', 'Mads Ringsted'), :'svar'::jsonb,
  'repeating the same one-time ID returns the first answer');
select is((select count(*) from public.medlem where user_id = :'ny'), 1::bigint,
  'repeating the same one-time ID creates no second box');

-- A new ID is a new box; the caller can be in several.
select public.opret_bodekasse(gen_random_uuid(), 'Poker-tirsdag', 'Mads');
select is((select count(*) from public.medlem where user_id = :'ny' and er_admin), 2::bigint,
  'the same person can create a second box and is Admin of both');

select throws_ok($$ select public.opret_bodekasse(gen_random_uuid(), '   ', 'Mads') $$,
  'P0001', 'navn_mangler', 'a box needs a name');
select throws_ok($$ select public.opret_bodekasse(gen_random_uuid(), 'Kassen', '') $$,
  'P0001', 'mit_navn_mangler', 'the creator needs a name');

-- Others don't see the box.
select tests.log_ind_som(:'anden');
select is_empty(format($$ select 1 from public.bodekasse where id = %L $$, :'kasse'),
  'another person cannot see the new box');

select * from finish();
rollback;
