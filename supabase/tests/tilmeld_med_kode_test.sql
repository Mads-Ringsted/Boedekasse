-- Jeg har en kode: a logged-in person finds a box by its join code, gives
-- their name and becomes a Medlem at once. An Udmeldt person can't rejoin.
begin;
\ir _hjaelpere.psql
select plan(16);

select tests.opret_bodekasse('FC Test') as kasse \gset
select tests.opret_medlem_med_login(:'kasse', 'Admin Anna', true) as anna \gset
select tests.opret_medlem(:'kasse', 'Sebastian', 'sebastian@test.dk') as sebastian \gset
insert into public.bodekasse_kode (bodekasse_id, kode) values (:'kasse', 'T3ST22');
select tests.opret_bruger('peter@test.dk') as peter \gset
select tests.opret_medlem_med_login(:'kasse', 'Udmeldt Ulla') as ulla \gset
update public.medlem set udmeldt = now() where id = :'ulla';
select gen_random_uuid() as id1 \gset

-- Finding the box: name and active Medlemmer, before joining.
select tests.log_ind_som(:'peter');
select is(public.find_bodekasse_med_kode(' t3st22 '),
  jsonb_build_object('bodekasse_id', :'kasse'::uuid, 'navn', 'FC Test',
                     'antal_medlemmer', 2, 'allerede_medlem', false),
  'the code finds the box: name and active Medlemmer, typed in any case');
select throws_ok($$ select public.find_bodekasse_med_kode('ZZZZZZ') $$,
  'P0001', 'kode_ukendt', 'an unknown code finds nothing');
select is_empty(format($$ select 1 from public.bodekasse where id = %L $$, :'kasse'),
  'finding the box does not make you a Medlem');

-- Joining.
select throws_ok($$ select public.tilmeld_med_kode(gen_random_uuid(), 'T3ST22', '  ') $$,
  'P0001', 'mit_navn_mangler', 'joining needs a name');
select public.tilmeld_med_kode(:'id1', 'T3ST22', ' Peter Skov ') as svar \gset
select (:'svar'::jsonb ->> 'medlem_id')::uuid as peter_m \gset
select is((:'svar'::jsonb ->> 'bodekasse_id')::uuid, :'kasse'::uuid, 'joining returns the box');
select results_eq(
  format($$ select navn, user_id, er_admin, email from public.medlem where id = %L $$, :'peter_m'),
  format($$ values ('Peter Skov', %L::uuid, false, 'peter@test.dk') $$, :'peter'),
  'the new Medlem has the given name, the caller''s login and email, and is not Admin');
select results_eq(format($$ select navn from public.bodekasse where id = %L $$, :'kasse'),
  $$ values ('FC Test') $$, 'the new Medlem now sees the box');
select results_eq(
  format($$ select art, aktoer_id, data ->> 'navn' from public.haendelse where ref_id = %L $$, :'peter_m'),
  format($$ values ('medlem_tilmeldt', %L::uuid, 'Peter Skov') $$, :'peter_m'),
  'one feed entry: Peter joined');
select is_empty($$ select 1 from public.bodekasse_kode $$,
  'a Medlem who joined by code cannot read the code');

select is(public.tilmeld_med_kode(:'id1', 'T3ST22', 'Peter Skov'), :'svar'::jsonb,
  'repeating the same one-time ID returns the first answer');
select is(public.tilmeld_med_kode(gen_random_uuid(), 'T3ST22', 'Andet navn'), :'svar'::jsonb,
  'joining again opens the same spot');
select results_eq(
  format($$ select count(*), min(navn) from public.medlem where user_id = %L $$, :'peter'),
  $$ values (1::bigint, 'Peter Skov') $$,
  'joining again adds no second Medlem and keeps the name');
select is((public.find_bodekasse_med_kode('T3ST22') ->> 'allerede_medlem')::boolean, true,
  'finding a box you are in says so');


-- Udmeldt can't rejoin.
select tests.log_ind_som_medlem(:'ulla');
select throws_ok($$ select public.find_bodekasse_med_kode('T3ST22') $$,
  'P0001', 'udmeldt', 'an Udmeldt person is told they can''t rejoin when finding the box');
select throws_ok($$ select public.tilmeld_med_kode(gen_random_uuid(), 'T3ST22', 'Ulla') $$,
  'P0001', 'udmeldt', 'an Udmeldt person cannot rejoin with the code');

-- No login, no lookup.
select tests.log_ind_som_anon();
select throws_ok($$ select public.find_bodekasse_med_kode('T3ST22') $$,
  '42501', null, 'a visitor without a login cannot look up a code');

select * from finish();
rollback;
