-- slet_bodekasse: an Admin deletes the whole box for everyone, after typing
-- its exact name.
begin;
\ir _hjaelpere.psql
select plan(9);

select tests.opret_bodekasse('FC Test') as a \gset
select tests.opret_bodekasse('Kasse B') as b \gset
select tests.opret_medlem_med_login(:'a', 'Mads', true) as mads \gset
select tests.opret_medlem_med_login(:'a', 'Jonas') as jonas \gset
select tests.opret_medlem(:'a', 'Sebastian', 'sebastian@test.dk') as sebastian \gset
select tests.opret_medlem_med_login(:'b', 'Bo', true) as bo \gset
select user_id as jonas_bruger from public.medlem where id = :'jonas' \gset
-- Some history: a Bødekategori, Bøder, an Anke, a Gebyr, an Indbetaling, a feed row.
select tests.opret_bodekategori(:'mads', 'For sent', 50) as kat \gset
select tests.giv_bode(:'mads', :'jonas', 50, :'kat') as bode \gset
select tests.giv_bode(:'jonas', :'sebastian') as bode2 \gset
select tests.anke(:'bode') as anke \gset
insert into public.gebyr (bodekasse_id, saeson_id, medlem_id, art, beloeb, anke_id)
values (:'a', (select seneste_saeson_id from public.bodekasse_saeson where bodekasse_id = :'a'), :'jonas', 'anke', 37, :'anke');
select tests.log_ind_som_medlem(:'mads');
select public.registrer_indbetaling(gen_random_uuid(), :'a', :'jonas', 50);
select tests.log_ud();

-- Not an Admin.
select tests.log_ind_som_medlem(:'jonas');
select throws_ok(format($$ select public.slet_bodekasse(gen_random_uuid(), %L, 'FC Test') $$, :'a'),
  '42501', 'ikke_admin', 'a plain Medlem can''t delete the box');

-- An Admin of another box.
select tests.log_ind_som_medlem(:'bo');
select throws_ok(format($$ select public.slet_bodekasse(gen_random_uuid(), %L, 'FC Test') $$, :'a'),
  '42501', 'ikke_medlem', 'an Admin of another box can''t delete it');

-- The Admin, with the wrong name.
select tests.log_ind_som_medlem(:'mads');
select throws_ok(format($$ select public.slet_bodekasse(gen_random_uuid(), %L, 'fc test') $$, :'a'),
  'P0001', 'navn_passer_ikke', 'the name must match exactly (case too)');
select throws_ok(format($$ select public.slet_bodekasse(gen_random_uuid(), %L, 'FC Tes') $$, :'a'),
  'P0001', 'navn_passer_ikke', 'part of the name is not enough');
select throws_ok(format($$ select public.slet_bodekasse(gen_random_uuid(), %L, null) $$, :'a'),
  'P0001', 'navn_passer_ikke', 'no name is not enough');

-- The Admin, with the exact name (spaces around it are fine).
select is(public.slet_bodekasse(gen_random_uuid(), :'a', ' FC Test '), '{}'::jsonb,
  'an Admin deletes the box with its exact name');

select tests.log_ud();
select is((select count(*)::int from public.bodekasse where id = :'a')
        + (select count(*)::int from public.medlem where bodekasse_id = :'a')
        + (select count(*)::int from public.bode where bodekasse_id = :'a')
        + (select count(*)::int from public.haendelse where bodekasse_id = :'a')
        + (select count(*)::int from public.saeson where bodekasse_id = :'a'),
  0, 'the box and everything in it is gone');
select isnt_empty(format($$ select 1 from auth.users where id = %L $$, :'jonas_bruger'),
  'the Medlemmer''s logins stay');
select isnt_empty(format($$ select 1 from public.medlem where id = %L $$, :'bo'),
  'other boxes stay');

select * from finish();
rollback;
