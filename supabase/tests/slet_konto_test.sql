-- slet_konto: a person deletes their login. Their Medlemmer stay as unclaimed
-- spots with name and history; the last Admin of a box must hand over first.
-- Also the sidste_admin_kasse view, which tells the app which boxes block it.
begin;
\ir _hjaelpere.psql
select plan(16);

select tests.opret_bodekasse('Kasse A') as a \gset
select tests.opret_bodekasse('Kasse B') as b \gset
select tests.opret_bodekasse('Kasse C') as c \gset
select tests.opret_bruger('mads@test.dk') as bruger \gset
-- Mads: Admin in A (with Frederik), plain in B, the only Admin in C.
select tests.opret_medlem(:'a', 'Mads', null, true, :'bruger') as mads_a \gset
select tests.opret_medlem(:'b', 'Madsen', null, false, :'bruger') as mads_b \gset
select tests.opret_medlem(:'c', 'Mads C', null, true, :'bruger') as mads_c \gset
select tests.opret_medlem_med_login(:'a', 'Frederik', true) as frederik \gset
select tests.opret_medlem_med_login(:'b', 'Bo', true) as bo \gset
select tests.opret_medlem_med_login(:'c', 'Carl') as carl \gset
update public.medlem set email = 'mads@test.dk' where id = :'mads_a';
select tests.giv_bode(:'frederik', :'mads_a') as bode \gset

-- The view: only C, where Mads is the last Admin.
select tests.log_ind_som(:'bruger');
select results_eq('select bodekasse_id, navn from public.sidste_admin_kasse',
  format($$ values (%L::uuid, 'Kasse C'::text) $$, :'c'),
  'sidste_admin_kasse lists the boxes where you are the last Admin');
select tests.log_ind_som_medlem(:'carl');
select is_empty('select 1 from public.sidste_admin_kasse', 'a plain Medlem has none');

-- Blocked while he is C's last Admin; nothing changes.
select tests.log_ind_som(:'bruger');
select throws_ok('select public.slet_konto(gen_random_uuid())',
  'P0001', 'sidste_admin', 'the last Admin of a box can''t delete the login');
select tests.log_ud();
select isnt_empty(format($$ select 1 from auth.users where id = %L $$, :'bruger'), 'the login is still there');

-- He hands the role over in C, then deletes the login.
update public.medlem set er_admin = true where id = :'carl';
select tests.log_ind_som(:'bruger');
select is_empty('select 1 from public.sidste_admin_kasse', 'after handing over, nothing blocks');
select is(public.slet_konto(gen_random_uuid()), '{}'::jsonb, 'slet_konto deletes the login');

select tests.log_ud();
select is_empty(format($$ select 1 from auth.users where id = %L $$, :'bruger'), 'the login is gone');
select results_eq(
  format($$ select id, navn, user_id, email, er_admin from public.medlem where id in (%L, %L, %L) order by navn $$,
         :'mads_a', :'mads_b', :'mads_c'),
  format($$ values (%L::uuid, 'Mads'::text, null::uuid, null::text, true),
                   (%L::uuid, 'Mads C', null, null, true),
                   (%L::uuid, 'Madsen', null, null, false) $$,
         :'mads_a', :'mads_c', :'mads_b'),
  'every Medlem stays, unclaimed, with its name and role and no email');
select isnt_empty(format($$ select 1 from public.bode where id = %L and modtager_id = %L $$, :'bode', :'mads_a'),
  'the history stays');
select is((select count(*)::int from public.medlem where id in (:'mads_a', :'mads_b', :'mads_c')
             and konto_slettet is not null), 3, 'each spot is marked as having had a login');

-- A spot whose login was deleted never counts as "never logged in".
select is((select grund from public.medlem_slet_grund where medlem_id = :'mads_b'), 'logget_ind',
  'medlem_slet_grund: a spot whose login was deleted counts as logged in');
select tests.log_ind_som_medlem(:'bo');
select throws_ok(format($$ select public.slet_medlem(gen_random_uuid(), %L, %L) $$, :'b', :'mads_b'),
  'P0001', 'medlem_logget_ind', 'so slet_medlem refuses it');

-- Logging in again with the same email does not take the spots back.
select tests.log_ud();
select tests.opret_bruger('mads@test.dk') as ny \gset
select is((select count(*)::int from public.medlem where user_id = :'ny'), 0,
  'a new login with the same email claims nothing');

-- An Admin can still set an email on the spot to invite someone.
select tests.log_ind_som_medlem(:'bo');
select is(public.ret_medlem_email(gen_random_uuid(), :'b', :'mads_b', 'ny@test.dk'),
  '{"email": "ny@test.dk"}'::jsonb, 'an Admin can give the spot a new email');

-- A login in no box can delete itself too; anon can't call it.
select tests.log_ud();
select tests.opret_bruger('ingen@test.dk') as ingen \gset
select tests.log_ind_som(:'ingen');
select is(public.slet_konto(gen_random_uuid()), '{}'::jsonb, 'a login in no box deletes itself');
select tests.log_ind_som_anon();
select throws_ok('select public.slet_konto(gen_random_uuid())', '42501', null, 'anon can''t call slet_konto');

select * from finish();
rollback;
