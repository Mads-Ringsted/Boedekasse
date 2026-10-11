-- The creation Gebyr: when the rule is on, whoever creates a Bødekategori
-- pays it in the same transaction. Never in a Pause, never retroactively.
begin;
\ir _hjaelpere.psql
select plan(11);

select tests.opret_bodekasse('Kasse A') as kasse \gset
select tests.opret_medlem_med_login(:'kasse', 'Mads', true) as admin \gset
select tests.opret_medlem_med_login(:'kasse', 'Jonas') as jonas \gset

-- ---------- Off (the default) ----------
select tests.log_ind_som_medlem(:'jonas');
select (public.opret_bodekategori(gen_random_uuid(), :'kasse', 'Gratis', 20) ->> 'bodekategori_id') as gratis \gset
select is((select count(*) from public.gebyr where medlem_id = :'jonas'), 0::bigint,
  'with the rule off, creating a Bødekategori is free');

-- ---------- On ----------
select tests.log_ind_som_medlem(:'admin');
select public.opdater_indstillinger(gen_random_uuid(), :'kasse',
  '{"oprettelsesgebyr_til": true, "oprettelsesgebyr": 30}');
select is((select count(*) from public.gebyr where bodekasse_id = :'kasse'), 0::bigint,
  'switching the rule on charges nothing for Bødekategorier already made');

select tests.log_ind_som_medlem(:'jonas');
select (public.opret_bodekategori(gen_random_uuid(), :'kasse', 'For sent', 50) ->> 'bodekategori_id') as for_sent \gset

select results_eq(
  format($$ select medlem_id, art::text, beloeb, bodekategori_id, annulleret
              from public.gebyr where bodekasse_id = %L $$, :'kasse'),
  format($$ values (%L::uuid, 'oprettelse', 30, %L::uuid, null::timestamptz) $$, :'jonas', :'for_sent'),
  'with the rule on, the creator pays the creation Gebyr for that Bødekategori');

select is((select saldo from public.medlem_saldo where medlem_id = :'jonas'), 30,
  'the Gebyr counts in the creator''s Saldo');

select is(
  (select m.boeder_i_alt from public.medlem_saeson_tal m
     join public.saeson_status s on s.id = m.saeson_id and s.er_seneste
    where m.medlem_id = :'jonas'),
  30, 'the Gebyr counts in the creator''s Bøder i alt this Sæson');

select results_eq(
  format($$ select data, jsonb_path_query_array(gebyrer, '$[*].beloeb')
              from public.aktivitet where ref_id = %L $$, :'for_sent'),
  $$ values ('{"navn": "For sent", "pris": 50}'::jsonb, '[30]'::jsonb) $$,
  'the Gebyr shows on the "created" feed row');

-- Prøv igen with the same one-time ID charges once.
select gen_random_uuid() as id_igen \gset
select public.opret_bodekategori(:'id_igen', :'kasse', 'Telefon', 20);
select public.opret_bodekategori(:'id_igen', :'kasse', 'Telefon', 20);
select is((select count(*) from public.gebyr where medlem_id = :'jonas'), 2::bigint,
  'a repeated one-time ID charges the Gebyr only once');

-- A rejected Bødekategori charges nothing.
select throws_ok(
  format($$ select public.opret_bodekategori(gen_random_uuid(), %L, 'for sent', 10) $$, :'kasse'),
  'P0001', 'navn_findes', 'a taken name is rejected');
select is((select count(*) from public.gebyr where medlem_id = :'jonas'), 2::bigint,
  'a rejected Bødekategori charges no Gebyr');

-- ---------- Off again: no refund ----------
select tests.log_ind_som_medlem(:'admin');
select public.opdater_indstillinger(gen_random_uuid(), :'kasse', '{"oprettelsesgebyr_til": false}');
select is((select count(*) from public.gebyr where medlem_id = :'jonas' and annulleret is null), 2::bigint,
  'switching the rule off refunds nothing');

-- ---------- Pause ----------
select public.opdater_indstillinger(gen_random_uuid(), :'kasse', '{"oprettelsesgebyr_til": true}');
select tests.log_ud();
update public.saeson set afsluttet = now() where bodekasse_id = :'kasse';
select tests.log_ind_som_medlem(:'jonas');
select public.opret_bodekategori(gen_random_uuid(), :'kasse', 'Pausebøde', 20);
select is((select count(*) from public.gebyr where medlem_id = :'jonas'), 2::bigint,
  'in a Pause a Bødekategori is created with no Gebyr');

select * from finish();
rollback;
