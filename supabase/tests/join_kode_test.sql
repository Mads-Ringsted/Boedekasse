-- The join code: made by an Admin (forny_join_kode), readable only by the
-- box's Admins.
begin;
\ir _hjaelpere.psql
select plan(5);

select tests.opret_bodekasse() as kasse \gset
select tests.opret_medlem_med_login(:'kasse', 'Admin Anna', true) as anna \gset
select tests.opret_medlem_med_login(:'kasse', 'Menig Mikkel') as mikkel \gset

select tests.log_ind_som_medlem(:'anna');
select public.forny_join_kode(gen_random_uuid(), :'kasse') ->> 'kode' as kode \gset

select matches(:'kode'::text, '^[A-HJKMNP-Z2-9]{6}$',
  'a new join code is 6 characters with no look-alikes');
select results_eq($$ select kode from public.bodekasse_kode $$, format($$ values (%L) $$, :'kode'),
  'an Admin reads the join code');

select tests.log_ind_som_medlem(:'mikkel');
select is_empty($$ select kode from public.bodekasse_kode $$,
  'a plain Medlem cannot read the join code');
select is((select count(*) from public.bodekasse where id = :'kasse'), 1::bigint,
  'a plain Medlem still reads the box itself');

select tests.log_ud();
update public.medlem set udmeldt = now() where id = :'anna';
select tests.log_ind_som_medlem(:'anna');
select is_empty($$ select kode from public.bodekasse_kode $$,
  'an Udmeldt Admin cannot read the join code');

select * from finish();
rollback;
