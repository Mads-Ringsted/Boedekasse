-- Migration safety (spec #74): a box with default settings behaves as before
-- the #74 changes. The Engangsbøde is free-amount, and giving Bøder makes no
-- Gebyrer other than the Engangsbøde Gebyr a new box already had.
-- Later #74 tickets add their own default-box checks here.
begin;
\ir _hjaelpere.psql
select plan(5);

select tests.opret_bodekasse('Kasse A') as kasse \gset
select tests.opret_medlem_med_login(:'kasse', 'Mads', true) as admin \gset
select tests.opret_medlem_med_login(:'kasse', 'Jonas') as jonas \gset
select tests.opret_medlem_med_login(:'kasse', 'Emil') as emil \gset
select tests.opret_bodekategori(:'admin', 'For sent', 20) as for_sent \gset

select tests.log_ind_som_medlem(:'jonas');
select public.giv_boeder(gen_random_uuid(), :'kasse', jsonb_build_array(
  jsonb_build_object('modtager_id', :'emil', 'bodekategori_id', :'for_sent', 'antal', 2),
  jsonb_build_object('modtager_id', :'emil', 'grund', 'Kom for sent til bryllup', 'beloeb', 1234)
)) ->> 'batch_id' as batch \gset

select is(
  (select pris from public.bode where batch_id = :'batch' and bodekategori_id is null),
  1234,
  'a default box stores any Engangsbøde amount the giver types (Fri)');

select results_eq(
  format($$ select medlem_id, art::text, beloeb from public.gebyr where bodekasse_id = %L $$, :'kasse'),
  format($$ values (%L::uuid, 'engangsbode', 10) $$, :'jonas'),
  'a default box charges only the 10 kr Engangsbøde Gebyr, nothing automatic');

select is(
  (select saldo from public.medlem_saldo where medlem_id = :'emil'),
  1274,
  'the receiver owes exactly the Bøder given');

-- Sen betaling (#80): the receiver still owes next month, well after the
-- Betalingsdag, but a default box charges no late fees.
select tests.log_ud();
select private.koer_automatik(date_trunc('month', now()) + interval '1 month 9 days 12 hours');
select is_empty(
  format($$ select 1 from public.gebyr where bodekasse_id = %L and art = 'sen_betaling' $$, :'kasse'),
  'a default box charges no Sen betaling');

-- #82: the Anke and payment pushes only add outbox rows. In a default box,
-- reporting and confirming a payment writes the same feed entries as before.
select tests.log_ind_som_medlem(:'emil');
select public.meld_betaling(gen_random_uuid(), :'kasse', 100) ->> 'betalingsmelding_id' as melding \gset
select tests.log_ind_som_medlem(:'admin');
select public.behandl_betalingsmelding(gen_random_uuid(), :'melding', true);
select tests.log_ud();
select results_eq(
  format($$ select art from public.haendelse where bodekasse_id = %L and art like 'betaling%%' $$, :'kasse'),
  $$ values ('betaling_bekraeftet') $$,
  'a default box''s payment flow writes the same feed entry as before the pushes');

select * from finish();
rollback;
