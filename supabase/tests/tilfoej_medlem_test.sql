-- tilfoej_medlem: an Admin adds a Medlem by name and email. The new Medlem can
-- get Bøder at once and is claimed when that email logs in.
begin;
\ir _hjaelpere.psql
select plan(14);

select tests.opret_bodekasse('Kasse A') as kasse \gset
select tests.opret_bodekasse('Kasse B') as anden_kasse \gset
select tests.opret_medlem_med_login(:'kasse', 'Admin Anna', true) as anna \gset
select tests.opret_medlem_med_login(:'kasse', 'Menig Mikkel') as mikkel \gset
select tests.opret_medlem_med_login(:'anden_kasse', 'Bo fra B', true) as bo \gset
select gen_random_uuid() as id1 \gset

select tests.log_ind_som_medlem(:'anna');
select public.tilfoej_medlem(:'id1', :'kasse', ' Peter Skov ', ' Peter@Test.DK ') as svar \gset
select (:'svar'::jsonb ->> 'medlem_id')::uuid as peter \gset

select results_eq(
  format($$ select navn, email, user_id, er_admin from public.medlem where id = %L $$, :'peter'),
  $$ values ('Peter Skov', 'peter@test.dk', null::uuid, false) $$,
  'the Admin sees the new Medlem: name trimmed, email lowercased, not logged in, not Admin');

select results_eq(
  format($$ select art, aktoer_id, modtager_id, data ->> 'navn' from public.haendelse
             where bodekasse_id = %L and ref_id = %L $$, :'kasse', :'peter'),
  format($$ values ('medlem_tilfoejet', %L::uuid, %L::uuid, 'Peter Skov') $$, :'anna', :'peter'),
  'one feed entry: the Admin added Peter');

select results_eq(
  format($$ select saldo from public.medlem_saldo where medlem_id = %L $$, :'peter'),
  $$ values (0) $$,
  'the new Medlem starts owing 0 kr');

-- Prøv igen with the same one-time ID: same answer, no second Medlem.
select is(public.tilfoej_medlem(:'id1', :'kasse', 'Peter Skov', 'peter@test.dk'), :'svar'::jsonb,
  'repeating the same one-time ID returns the first answer');
select is((select count(*) from public.medlem where bodekasse_id = :'kasse'), 3::bigint,
  'repeating the same one-time ID adds no second Medlem');

select throws_ok(
  format($$ select public.tilfoej_medlem(gen_random_uuid(), %L, 'Peter igen', 'PETER@test.dk') $$, :'kasse'),
  'P0001', 'email_findes', 'an email already in the box is rejected');

-- The email of someone who already has a login in the box (e.g. joined by code).
select tests.log_ud();
select email as anna_email from auth.users where id = (select user_id from public.medlem where id = :'anna') \gset
select tests.log_ind_som_medlem(:'anna');
select throws_ok(
  format($$ select public.tilfoej_medlem(gen_random_uuid(), %L, 'Anna igen', %L) $$, :'kasse', :'anna_email'),
  'P0001', 'email_findes', 'the email of a logged-in Medlem of the box is rejected');

select throws_ok(
  format($$ select public.tilfoej_medlem(gen_random_uuid(), %L, '  ', 'x@test.dk') $$, :'kasse'),
  'P0001', 'medlem_navn_mangler', 'a Medlem needs a name');
select throws_ok(
  format($$ select public.tilfoej_medlem(gen_random_uuid(), %L, 'X', '  ') $$, :'kasse'),
  'P0001', 'email_mangler', 'a Medlem needs an email');
select throws_ok(
  format($$ select public.tilfoej_medlem(gen_random_uuid(), %L, 'X', 'ikke-en-email') $$, :'kasse'),
  'P0001', 'email_ugyldig', 'the email must look like an email');

-- The same email can be added in another box.
select tests.log_ind_som_medlem(:'bo');
select lives_ok(
  format($$ select public.tilfoej_medlem(gen_random_uuid(), %L, 'Peter', 'peter@test.dk') $$, :'anden_kasse'),
  'the same email can be a Medlem of another box');

-- Only an active Admin of the box can add.
select tests.log_ind_som_medlem(:'mikkel');
select throws_ok(
  format($$ select public.tilfoej_medlem(gen_random_uuid(), %L, 'Y', 'y@test.dk') $$, :'kasse'),
  '42501', 'ikke_admin', 'a plain Medlem cannot add a Medlem');

select tests.log_ind_som_medlem(:'bo');
select throws_ok(
  format($$ select public.tilfoej_medlem(gen_random_uuid(), %L, 'Y', 'y@test.dk') $$, :'kasse'),
  '42501', 'ikke_medlem', 'an Admin of another box cannot add a Medlem');

-- A pre-added Medlem is claimed when that email logs in.
select tests.log_ud();
select tests.opret_bruger('peter@test.dk') as peter_login \gset
select is((select user_id from public.medlem where id = :'peter'), :'peter_login'::uuid,
  'Peter''s first login takes over the pre-added spot');

select * from finish();
rollback;
