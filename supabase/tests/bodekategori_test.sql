-- Bødekategorier: any Medlem creates one; only its creator or an Admin edits,
-- archives and brings it back. Editing never touches existing Bøder' prices.
begin;
\ir _hjaelpere.psql
select plan(27);

select tests.opret_bodekasse('Kasse A') as kasse \gset
select tests.opret_medlem_med_login(:'kasse', 'Mads', true) as admin \gset
select tests.opret_medlem_med_login(:'kasse', 'Jonas') as jonas \gset
select tests.opret_medlem_med_login(:'kasse', 'Emil') as emil \gset

-- ---------- Opret ----------
select tests.log_ind_som_medlem(:'jonas');
select public.opret_bodekategori(gen_random_uuid(), :'kasse', '  For sent 🕐 ', 50, '  Mere end 5 min. ')
  as svar \gset
select (:'svar'::jsonb ->> 'bodekategori_id')::uuid as for_sent \gset

select results_eq(
  format($$ select navn, pris, beskrivelse, oprettet_af, arkiveret from public.bodekategori where id = %L $$, :'for_sent'),
  format($$ values ('For sent 🕐', 50, 'Mere end 5 min.', %L::uuid, null::timestamptz) $$, :'jonas'),
  'any Medlem creates a Bødekategori; name and description are trimmed');

select results_eq(
  format($$ select art, aktoer_id, data from public.haendelse where ref_id = %L $$, :'for_sent'),
  format($$ values ('bodekategori_oprettet', %L::uuid, '{"navn": "For sent 🕐", "pris": 50}'::jsonb) $$, :'jonas'),
  'creating it adds one feed entry');

select results_eq(
  format($$ select ofte_brugt, antal from public.bodekategori_brug where bodekategori_id = %L $$, :'for_sent'),
  $$ values (false, 0) $$,
  'a new Bødekategori is unused this Sæson');

select throws_ok(
  format($$ select public.opret_bodekategori(gen_random_uuid(), %L, 'FOR SENT 🕐', 20) $$, :'kasse'),
  'P0001', 'navn_findes',
  'the name is taken among active ones, whatever the case');

select throws_ok(
  format($$ select public.opret_bodekategori(gen_random_uuid(), %L, 'Gratis', 0) $$, :'kasse'),
  'P0001', 'pris_ugyldig',
  'the price must be above 0 kr');

select throws_ok(
  format($$ select public.opret_bodekategori(gen_random_uuid(), %L, '   ', 10) $$, :'kasse'),
  'P0001', 'kategorinavn_mangler',
  'the name is required');

-- Prøv igen with the same one-time ID.
select gen_random_uuid() as id_igen \gset
select public.opret_bodekategori(:'id_igen', :'kasse', 'Telefon', 20) as svar_igen \gset
select is(public.opret_bodekategori(:'id_igen', :'kasse', 'Telefon', 20), :'svar_igen'::jsonb,
  'repeating the same one-time ID returns the first answer');
select is((select count(*) from public.bodekategori where navn = 'Telefon'), 1::bigint,
  'repeating the same one-time ID creates nothing new');

-- Someone outside the box.
select tests.opret_bodekasse('Kasse B') as kasse_b \gset
select tests.opret_medlem_med_login(:'kasse_b', 'Fremmed') as fremmed \gset
select tests.log_ind_som_medlem(:'fremmed');
select throws_ok(
  format($$ select public.opret_bodekategori(gen_random_uuid(), %L, 'Snyd', 10) $$, :'kasse'),
  '42501', 'ikke_medlem',
  'a non-Medlem cannot create one in the box');

-- In a Pause (the Sæson ended): still allowed.
select tests.log_ud();
update public.saeson set afsluttet = now() where bodekasse_id = :'kasse';
select tests.log_ind_som_medlem(:'emil');
select lives_ok(
  format($$ select public.opret_bodekategori(gen_random_uuid(), %L, 'Pausebøde', 15) $$, :'kasse'),
  'a Bødekategori can be created in a Pause');
select tests.log_ud();
update public.saeson set afsluttet = null where bodekasse_id = :'kasse';

-- ---------- Ret ----------
select tests.giv_bode(:'admin', :'emil', p_kategori => :'for_sent') as gammel_bode \gset

select tests.log_ind_som_medlem(:'emil');
select throws_ok(
  format($$ select public.ret_bodekategori(gen_random_uuid(), %L, 'Mit navn', 10, null) $$, :'for_sent'),
  '42501', 'ikke_tilladt',
  'another Medlem cannot edit it');

select tests.log_ind_som_medlem(:'jonas');
select lives_ok(
  format($$ select public.ret_bodekategori(gen_random_uuid(), %L, ' For sent ', 60, '') $$, :'for_sent'),
  'the creator edits it for free');

select results_eq(
  format($$ select navn, pris, beskrivelse from public.bodekategori where id = %L $$, :'for_sent'),
  $$ values ('For sent', 60, null::text) $$,
  'the edit is saved; an empty description is cleared');

select results_eq(
  format($$ select pris from public.bode where id = %L $$, :'gammel_bode'),
  $$ values (50) $$,
  'an existing Bøde keeps its price');

select results_eq(
  format($$ select data from public.haendelse where ref_id = %L and art = 'bodekategori_ompriset' $$, :'for_sent'),
  $$ values ('{"navn": "For sent", "gammel_pris": 50, "ny_pris": 60}'::jsonb) $$,
  'a new price adds a feed entry');

select tests.log_ind_som_medlem(:'admin');
select public.ret_bodekategori(gen_random_uuid(), :'for_sent', 'Kom for sent', 60, 'Mere end 5 min.');
select results_eq(
  format($$ select navn, count(*) over () from public.bodekategori where id = %L $$, :'for_sent'),
  $$ values ('Kom for sent', 1::bigint) $$,
  'an Admin edits it too');
select is(
  (select count(*) from public.haendelse where ref_id = :'for_sent' and art = 'bodekategori_ompriset'),
  1::bigint,
  'a name or description edit adds no feed entry');

select throws_ok(
  format($$ select public.ret_bodekategori(gen_random_uuid(), %L, 'telefon', 60, null) $$, :'for_sent'),
  'P0001', 'navn_findes',
  'an edit cannot take another active one''s name');

-- ---------- Arkivér og gendan ----------
select tests.log_ind_som_medlem(:'emil');
select throws_ok(
  format($$ select public.arkiver_bodekategori(gen_random_uuid(), %L) $$, :'for_sent'),
  '42501', 'ikke_tilladt',
  'another Medlem cannot archive it');

select tests.log_ind_som_medlem(:'jonas');
select lives_ok(
  format($$ select public.arkiver_bodekategori(gen_random_uuid(), %L) $$, :'for_sent'),
  'the creator archives it');
select isnt(
  (select arkiveret from public.bodekategori where id = :'for_sent'), null,
  'it is archived');
select results_eq(
  format($$ select aktoer_id, data from public.haendelse where ref_id = %L and art = 'bodekategori_arkiveret' $$, :'for_sent'),
  format($$ values (%L::uuid, '{"navn": "Kom for sent", "pris": 60}'::jsonb) $$, :'jonas'),
  'archiving adds a feed entry');
select throws_ok(
  format($$ select public.ret_bodekategori(gen_random_uuid(), %L, 'Kom for sent', 70, null) $$, :'for_sent'),
  'P0001', 'arkiveret',
  'an archived one cannot be edited');

select tests.log_ind_som_medlem(:'emil');
select lives_ok(
  format($$ select public.opret_bodekategori(gen_random_uuid(), %L, 'kom for sent', 30) $$, :'kasse'),
  'an archived name can be reused');

select tests.log_ind_som_medlem(:'admin');
select throws_ok(
  format($$ select public.gendan_bodekategori(gen_random_uuid(), %L) $$, :'for_sent'),
  'P0001', 'navn_findes',
  'it cannot come back while its name is taken');
select public.arkiver_bodekategori(gen_random_uuid(), id)
  from public.bodekategori where navn = 'kom for sent';
select lives_ok(
  format($$ select public.gendan_bodekategori(gen_random_uuid(), %L) $$, :'for_sent'),
  'an Admin brings it back once the name is free');
select is(
  (select arkiveret from public.bodekategori where id = :'for_sent'), null,
  'it is active again');

select * from finish();
rollback;
