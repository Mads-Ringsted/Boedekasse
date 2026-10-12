-- The shared rules every write RPC follows, checked through real RPCs:
-- resolve the caller's Medlem (reject Udmeldt / non-Medlem / non-Admin),
-- ignore a repeat of the same client-made one-time ID, and append a feed
-- entry by the caller in the latest Sæson.
-- opret_bodekategori stands in for any Medlem's RPC, forny_join_kode for an
-- Admin-only one.
begin;
\ir _hjaelpere.psql
select plan(10);

select tests.opret_bodekasse('Kasse A') as kasse \gset
select tests.opret_bodekasse('Kasse B') as anden \gset
select tests.opret_medlem_med_login(:'kasse', 'Anna', true) as anna \gset
select tests.opret_medlem_med_login(:'kasse', 'Mikkel') as mikkel \gset
select tests.opret_medlem_med_login(:'kasse', 'Ulla') as ulla \gset
select tests.opret_medlem_med_login(:'anden', 'Bo') as bo \gset
update public.medlem set udmeldt = now() where id = :'ulla';
select seneste_saeson_id as s1 from public.bodekasse_saeson where bodekasse_id = :'kasse' \gset
select gen_random_uuid() as id1 \gset
select gen_random_uuid() as id2 \gset

select tests.log_ind_som_medlem(:'mikkel');
select public.opret_bodekategori(:'id1', :'kasse', 'Kage', 20) as svar \gset
select isnt(:'svar'::jsonb ->> 'bodekategori_id', null, 'a Medlem can call an RPC');
select results_eq(
  $$ select art, aktoer_id, saeson_id from public.aktivitet $$,
  format($$ values ('bodekategori_oprettet', %L::uuid, %L::uuid) $$, :'mikkel', :'s1'),
  'the RPC appends one feed entry by the caller in the latest Sæson');

select is(public.opret_bodekategori(:'id1', :'kasse', 'Kage', 20), :'svar'::jsonb,
  'repeating the same one-time ID returns the first answer');
select results_eq(
  $$ select (select count(*) from public.bodekategori), (select count(*) from public.aktivitet) $$,
  $$ values (1::bigint, 1::bigint) $$,
  'repeating the same one-time ID writes nothing more');

select public.opret_bodekategori(:'id2', :'kasse', 'Øl', 30);
select is((select count(*) from public.aktivitet), 2::bigint, 'a new one-time ID is a new call');

select throws_ok(format($$ select public.forny_join_kode(gen_random_uuid(), %L) $$, :'kasse'),
  '42501', 'ikke_admin', 'an Admin-only RPC rejects a plain Medlem');

select tests.log_ind_som_medlem(:'anna');
select lives_ok(format($$ select public.forny_join_kode(gen_random_uuid(), %L) $$, :'kasse'),
  'an Admin-only RPC accepts an Admin');

select tests.log_ind_som_medlem(:'ulla');
select throws_ok(format($$ select public.opret_bodekategori(gen_random_uuid(), %L, 'Snyd', 10) $$, :'kasse'),
  '42501', 'ikke_medlem', 'an Udmeldt Medlem is rejected');

select tests.log_ind_som_medlem(:'bo');
select throws_ok(format($$ select public.opret_bodekategori(gen_random_uuid(), %L, 'Snyd', 10) $$, :'kasse'),
  '42501', 'ikke_medlem', 'a Medlem of another box is rejected');
select throws_ok(format($$ select public.opret_bodekategori(%L, %L, 'Kage', 20) $$, :'id1', :'anden'),
  'P0001', 'klient_id_brugt', 'someone else''s one-time ID is refused, not replayed');

select * from finish();
rollback;
