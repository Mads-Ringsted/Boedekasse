-- ret_medlem_navn / ret_medlem_email: an Admin fixes a Medlem's name, and
-- their email until they log in. No feed entry.
begin;
\ir _hjaelpere.psql
select plan(11);

select tests.opret_bodekasse('Kasse A') as a \gset
select tests.opret_medlem_med_login(:'a', 'Mads', true) as mads \gset
select tests.opret_medlem_med_login(:'a', 'Jonas') as jonas \gset
select tests.opret_medlem(:'a', 'Sebastian', 'sebastian@test.dk') as sebastian \gset
select tests.opret_medlem(:'a', 'Emil', 'emil@test.dk') as emil \gset
select gen_random_uuid() as id1 \gset

select tests.log_ind_som_medlem(:'mads');
select is(public.ret_medlem_navn(:'id1', :'a', :'jonas', '  Jonas Holm '), jsonb_build_object('navn', 'Jonas Holm'),
  'an Admin renames a Medlem, trimmed');
select is((select navn from public.medlem where id = :'jonas'), 'Jonas Holm', 'the new name is stored');
select throws_ok(format($$ select public.ret_medlem_navn(gen_random_uuid(), %L, %L, ' ') $$, :'a', :'jonas'),
  'P0001', 'medlem_navn_mangler', 'a name can''t be empty');

select is(public.ret_medlem_email(gen_random_uuid(), :'a', :'sebastian', ' Seb@Test.dk '),
  jsonb_build_object('email', 'seb@test.dk'), 'an Admin fixes the email of a Medlem who has not logged in');
select throws_ok(format($$ select public.ret_medlem_email(gen_random_uuid(), %L, %L, 'emil@test.dk') $$, :'a', :'sebastian'),
  'P0001', 'email_findes', 'the email can''t be another Medlem''s');
select throws_ok(format($$ select public.ret_medlem_email(gen_random_uuid(), %L, %L, 'nej') $$, :'a', :'sebastian'),
  'P0001', 'email_ugyldig', 'the email must look like one');
select throws_ok(format($$ select public.ret_medlem_email(gen_random_uuid(), %L, %L, 'j@test.dk') $$, :'a', :'jonas'),
  'P0001', 'medlem_logget_ind', 'the email is locked once the Medlem has logged in');

-- A fixed email claims at once when that login already exists.
select tests.log_ud();
select tests.opret_bruger('emil.b@test.dk') as emil_login \gset
select tests.log_ind_som_medlem(:'mads');
select public.ret_medlem_email(gen_random_uuid(), :'a', :'emil', 'emil.b@test.dk');
select is((select user_id from public.medlem where id = :'emil'), :'emil_login'::uuid,
  'a fixed email is claimed by the login that has it');

select is_empty(format($$ select 1 from public.haendelse where bodekasse_id = %L $$, :'a'),
  'name and email changes make no feed entry');

select tests.log_ind_som_medlem(:'jonas');
select throws_ok(format($$ select public.ret_medlem_navn(gen_random_uuid(), %L, %L, 'X') $$, :'a', :'mads'),
  '42501', 'ikke_admin', 'a plain Medlem can''t rename others');
select throws_ok(format($$ select public.ret_medlem_email(gen_random_uuid(), %L, %L, 'x@test.dk') $$, :'a', :'sebastian'),
  '42501', 'ikke_admin', 'a plain Medlem can''t change emails');

select * from finish();
rollback;
