-- A Medlem sees only rows of their own Bødekasser. Udmeldte and strangers see nothing.
begin;
\ir _hjaelpere.psql
select plan(6);

select tests.opret_bodekasse('Kasse A') as a \gset
select tests.opret_bodekasse('Kasse B') as b \gset
select tests.opret_medlem_med_login(:'a', 'Anna') as anna \gset
select tests.opret_medlem_med_login(:'a', 'Asger') as asger \gset
select tests.opret_medlem_med_login(:'b', 'Bo') as bo \gset
select tests.opret_medlem_med_login(:'a', 'Ulla') as ulla \gset
update public.medlem set udmeldt = now() where id = :'ulla';

select tests.log_ind_som_medlem(:'anna');
select results_eq(
  $$ select navn from public.bodekasse $$,
  $$ values ('Kasse A') $$,
  'a Medlem sees only their own Bødekasse');
select results_eq(
  $$ select navn from public.medlem order by navn $$,
  $$ values ('Anna'), ('Asger'), ('Ulla') $$,
  'a Medlem sees the Medlemmer of their own Bødekasse, Udmeldte included');
select is((select count(*) from public.saeson), 1::bigint,
  'a Medlem sees only their own Sæsoner');

select tests.log_ind_som_medlem(:'bo');
select results_eq(
  $$ select navn from public.medlem $$,
  $$ values ('Bo') $$,
  'the other Bødekasse sees only its own Medlemmer');

select tests.log_ind_som_medlem(:'ulla');
select is_empty($$ select 1 from public.bodekasse $$,
  'an Udmeldt Medlem no longer sees the Bødekasse');

select tests.log_ind_som(tests.opret_bruger('fremmed@test.dk'));
select is_empty($$ select 1 from public.medlem $$,
  'a login with no Medlem sees nothing');

select * from finish();
rollback;
