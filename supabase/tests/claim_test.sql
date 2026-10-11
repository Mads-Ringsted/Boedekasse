-- Claiming a spot: a pre-added Medlem is linked to the login with the same
-- (lowercased) email once that email is confirmed, in every box at once.
-- If this trigger breaks, every sign-up breaks.
begin;
\ir _hjaelpere.psql
select plan(9);

select tests.opret_bodekasse('Kasse A') as a \gset
select tests.opret_bodekasse('Kasse B') as b \gset
select tests.opret_medlem(:'a', 'Kasper', 'KASPER@Test.dk') as kasper_a \gset
select tests.opret_medlem(:'b', 'Kasper', 'kasper@test.dk') as kasper_b \gset

select is((select email from public.medlem where id = :'kasper_a'), 'kasper@test.dk',
  'a Medlem email is stored lowercased');

-- Requesting a code creates an unconfirmed login: nothing is claimed yet.
select tests.opret_bruger('kasper@test.dk', false) as kasper \gset
select tests.log_ind_som(:'kasper');
select is_empty($$ select 1 from public.bodekasse $$,
  'an unconfirmed login claims nothing');

-- Verifying the code confirms the email: both spots are claimed.
select tests.log_ud();
update auth.users set email_confirmed_at = now() where id = :'kasper';
select tests.log_ind_som(:'kasper');
select results_eq(
  $$ select m.id from public.medlem m where m.user_id = auth.uid() order by m.id $$,
  format($$ select unnest(array[%L, %L]::uuid[]) order by 1 $$, :'kasper_a', :'kasper_b'),
  'confirming the email claims the Medlem in every box');
select results_eq($$ select navn from public.bodekasse order by navn $$,
  $$ values ('Kasse A'), ('Kasse B') $$,
  'the claimed person sees both boxes');

-- A Medlem added after the person already has a login is claimed at once.
select tests.opret_bodekasse('Kasse C') as c \gset
select tests.opret_medlem(:'c', 'Kasper', 'Kasper@test.dk') as kasper_c \gset
select tests.log_ind_som(:'kasper');
select is((select count(*) from public.medlem where user_id = auth.uid()), 3::bigint,
  'adding a Medlem with a confirmed login''s email claims it at once');

-- A Medlem added for an unconfirmed login waits.
select tests.log_ud();
select tests.opret_bruger('ny@test.dk', false) as ny \gset
select tests.opret_medlem(:'a', 'Ny', 'ny@test.dk') as ny_a \gset
select is((select user_id from public.medlem where id = :'ny_a'), null,
  'a Medlem for an unconfirmed login stays unclaimed');

-- Someone who already joined a box by code, and was also pre-added there by
-- email, can still sign up. The extra spot stays unclaimed.
select tests.opret_bruger('dobbelt@test.dk', false) as dobbelt \gset
select tests.opret_medlem(:'a', 'Dobbelt (kode)', null, false, :'dobbelt') as dobbelt_kode \gset
select tests.opret_medlem(:'a', 'Dobbelt (email)', 'dobbelt@test.dk') as dobbelt_email \gset
select lives_ok(
  format($$ update auth.users set email_confirmed_at = now() where id = %L $$, :'dobbelt'),
  'confirming still works when the person already has a spot in that box');
select is((select user_id from public.medlem where id = :'dobbelt_email'), null,
  'the extra spot in that box stays unclaimed');

-- Slet konto: deleting the login keeps the Medlem and its history, unclaimed.
delete from auth.users where id = :'kasper';
select is((select count(*) from public.medlem where id in (:'kasper_a', :'kasper_b', :'kasper_c') and user_id is null),
  3::bigint, 'deleting a login unclaims its Medlemmer and keeps them');

select * from finish();
rollback;
