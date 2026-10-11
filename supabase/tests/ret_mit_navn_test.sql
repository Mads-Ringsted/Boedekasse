-- ret_mit_navn: a Medlem changes their own name in one box. Names are per box.
begin;
\ir _hjaelpere.psql
select plan(7);

select tests.opret_bodekasse('Kasse A') as a \gset
select tests.opret_bodekasse('Kasse B') as b \gset
select tests.opret_bruger('mads@test.dk') as mads \gset
select tests.opret_medlem(:'a', 'Mads', null, false, :'mads') as mads_a \gset
select tests.opret_medlem(:'b', 'Mads R.', null, true, :'mads') as mads_b \gset
select tests.opret_medlem_med_login(:'a', 'Anna') as anna \gset
select gen_random_uuid() as id1 \gset

select tests.log_ind_som(:'mads');
select is(public.ret_mit_navn(:'id1', :'a', '  Mads Ringsted '), jsonb_build_object('navn', 'Mads Ringsted'),
  'renaming returns the new name, trimmed');
select results_eq(
  $$ select b.navn, m.navn from public.medlem m join public.bodekasse b on b.id = m.bodekasse_id
      where m.user_id = auth.uid() order by b.navn $$,
  $$ values ('Kasse A', 'Mads Ringsted'), ('Kasse B', 'Mads R.') $$,
  'the name changes in that box only; the same person keeps another name in another box');

select tests.log_ind_som_medlem(:'anna');
select is((select navn from public.medlem where id = :'mads_a'), 'Mads Ringsted',
  'other Medlemmer see the new name');
select is_empty(format($$ select 1 from public.haendelse where bodekasse_id = %L $$, :'a'),
  'a name change makes no feed entry');

select tests.log_ind_som(:'mads');
select throws_ok(format($$ select public.ret_mit_navn(gen_random_uuid(), %L, ' ') $$, :'a'),
  'P0001', 'mit_navn_mangler', 'a name can''t be empty');

select tests.log_ud();
update public.medlem set udmeldt = now() where id = :'mads_a';
select tests.log_ind_som(:'mads');
select throws_ok(format($$ select public.ret_mit_navn(gen_random_uuid(), %L, 'X') $$, :'a'),
  '42501', 'ikke_medlem', 'an Udmeldt Medlem cannot rename themself');

select tests.log_ind_som_medlem(:'anna');
select throws_ok(format($$ select public.ret_mit_navn(gen_random_uuid(), %L, 'X') $$, :'b'),
  '42501', 'ikke_medlem', 'you cannot rename yourself in a box you are not in');

select * from finish();
rollback;
