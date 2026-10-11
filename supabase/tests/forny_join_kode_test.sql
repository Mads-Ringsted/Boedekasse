-- forny_join_kode: an Admin makes a new join code; the old one stops working.
begin;
\ir _hjaelpere.psql
select plan(6);

select tests.opret_bodekasse('Kasse A') as kasse \gset
select tests.opret_medlem_med_login(:'kasse', 'Admin Anna', true) as anna \gset
select tests.opret_medlem_med_login(:'kasse', 'Menig Mikkel') as mikkel \gset
select tests.opret_bruger('ny@test.dk') as ny \gset
insert into public.bodekasse_kode (bodekasse_id, kode) values (:'kasse', 'GAML22');
select gen_random_uuid() as id1 \gset

select tests.log_ind_som_medlem(:'anna');
select public.forny_join_kode(:'id1', :'kasse') as svar \gset

select results_eq($$ select kode from public.bodekasse_kode $$,
  format($$ values (%L) $$, :'svar'::jsonb ->> 'kode'),
  'the Admin reads the new code the RPC returned');
select isnt(:'svar'::jsonb ->> 'kode', 'GAML22', 'the new code differs from the old one');
select is(public.forny_join_kode(:'id1', :'kasse'), :'svar'::jsonb,
  'repeating the same one-time ID returns the same code');

select tests.log_ind_som(:'ny');
select throws_ok($$ select public.find_bodekasse_med_kode('GAML22') $$,
  'P0001', 'kode_ukendt', 'the old code no longer finds the box');
select throws_ok($$ select public.tilmeld_med_kode(gen_random_uuid(), 'GAML22', 'Ny') $$,
  'P0001', 'kode_ukendt', 'the old code no longer lets anyone join');

select tests.log_ind_som_medlem(:'mikkel');
select throws_ok(format($$ select public.forny_join_kode(gen_random_uuid(), %L) $$, :'kasse'),
  '42501', 'ikke_admin', 'a plain Medlem cannot make a new code');

select * from finish();
rollback;
