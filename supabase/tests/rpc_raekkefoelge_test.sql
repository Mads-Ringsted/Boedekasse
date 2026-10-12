-- Every write RPC resolves the caller first, then looks at the one-time ID
-- (spec: resolve caller -> rules -> write, ignoring a repeat ID). So an
-- outsider who reuses someone else's one-time ID is told they are not a
-- Medlem (42501), never "klient_id_brugt".
begin;
\ir _hjaelpere.psql
select plan(9);

select tests.opret_bodekasse('Kasse A') as kasse \gset
select tests.opret_bodekasse('Kasse B') as anden \gset
select tests.opret_medlem_med_login(:'kasse', 'Anna', true) as anna \gset
select tests.opret_medlem_med_login(:'kasse', 'Carl') as carl \gset
select tests.opret_medlem_med_login(:'anden', 'Bo') as bo \gset

-- State in box A, made through the public RPCs.
select tests.log_ind_som_medlem(:'anna');
select public.opdater_indstillinger(gen_random_uuid(), :'kasse',
  '{"oprettelsesgebyr_til": true, "oprettelsesgebyr": 30, "frikob_til": true, "frikob_pris": 300}');
select public.opret_bodekategori(gen_random_uuid(), :'kasse', 'For sent', 50) ->> 'bodekategori_id' as kategori \gset
select id as gebyr from public.gebyr where bodekategori_id = :'kategori' \gset
select public.giv_boeder(gen_random_uuid(), :'kasse', jsonb_build_array(jsonb_build_object('modtager_id', :'carl', 'bodekategori_id', :'kategori', 'antal', 1)))
  ->> 'batch_id' as batch \gset
select id as bode from public.bode where batch_id = :'batch' \gset
select gen_random_uuid() as brugt \gset
select public.registrer_indbetaling(:'brugt', :'kasse', :'carl', 80) ->> 'indbetaling_id' as indbetaling \gset
select public.haev(gen_random_uuid(), :'kasse', 20, 'Øl') ->> 'haevning_id' as haevning \gset
select public.koeb_frikob(gen_random_uuid(), :'kasse', :'kategori', :'carl') ->> 'frikob_id' as frikob \gset
select tests.log_ind_som_medlem(:'carl');
select public.meld_betaling(gen_random_uuid(), :'kasse', 50) ->> 'betalingsmelding_id' as melding \gset

-- Bo (box B) reuses Anna's one-time ID on box A's records.
select tests.log_ind_som_medlem(:'bo');
select throws_ok(format($$ select public.annuller_bode(%L, %L) $$, :'brugt', :'bode'),
  '42501', 'ikke_medlem', 'annuller_bode checks the caller before the one-time ID');
select throws_ok(format($$ select public.annuller_gebyr(%L, %L) $$, :'brugt', :'gebyr'),
  '42501', 'ikke_medlem', 'annuller_gebyr checks the caller before the one-time ID');
select throws_ok(format($$ select public.annuller_frikob(%L, %L) $$, :'brugt', :'frikob'),
  '42501', 'ikke_medlem', 'annuller_frikob checks the caller before the one-time ID');
select throws_ok(format($$ select public.annuller_haevning(%L, %L) $$, :'brugt', :'haevning'),
  '42501', 'ikke_medlem', 'annuller_haevning checks the caller before the one-time ID');
select throws_ok(format($$ select public.annuller_indbetaling(%L, %L) $$, :'brugt', :'indbetaling'),
  '42501', 'ikke_medlem', 'annuller_indbetaling checks the caller before the one-time ID');
select throws_ok(format($$ select public.fortryd_betalingsmelding(%L, %L) $$, :'brugt', :'melding'),
  '42501', 'ikke_medlem', 'fortryd_betalingsmelding checks the caller before the one-time ID');
select throws_ok(format($$ select public.behandl_betalingsmelding(%L, %L, true) $$, :'brugt', :'melding'),
  '42501', 'ikke_medlem', 'behandl_betalingsmelding checks the caller before the one-time ID');
select throws_ok(format($$ select public.fortryd_batch(%L, %L) $$, :'brugt', :'batch'),
  '42501', 'ikke_medlem', 'fortryd_batch checks the caller before the one-time ID');
select throws_ok(format($$ select public.slet_bodekasse(%L, %L, 'Kasse A') $$, :'brugt', :'kasse'),
  '42501', 'ikke_medlem', 'slet_bodekasse checks the caller before the one-time ID');

select * from finish();
rollback;
