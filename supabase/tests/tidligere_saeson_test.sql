-- #68: past Sæsoner are read-only. Once the next Sæson starts, no write RPC
-- accepts the old Sæson's records. Payments toward old debt go in the
-- current Sæson, and the old debt shows as "Overført fra sidste sæson".
--
-- Adding a write RPC that changes an existing Sæson-bound record (annul a
-- Bøde, Gebyr, Hævning, Frikøb, Konkurrence; an Anke verdict …)? Add a
-- throws_ok for it below.
begin;
\ir _hjaelpere.psql
select plan(16);

select tests.opret_bodekasse() as kasse \gset
select id as foerste from public.saeson where bodekasse_id = :'kasse' \gset
select tests.opret_medlem_med_login(:'kasse', 'Mads', true) as mads \gset
select tests.opret_medlem_med_login(:'kasse', 'Jonas') as jonas \gset
select tests.opret_bodekategori(:'mads', 'For sent', 50) as for_sent \gset

-- Sæson 1: Mads gives Jonas a 50 kr Bøde (still within the Fortryd window),
-- and Jonas pays 20 kr of it.
select tests.log_ind_som_medlem(:'mads');
select (public.giv_boeder(gen_random_uuid(), :'kasse', jsonb_build_array(
          jsonb_build_object('modtager_id', :'jonas', 'bodekategori_id', :'for_sent', 'antal', 1)))
        ->> 'batch_id') as batch \gset
select public.registrer_indbetaling(gen_random_uuid(), :'kasse', :'jonas', 20) ->> 'indbetaling_id' as gammel_betaling \gset

-- More Sæson 1 records, written directly (their own RPCs are tested elsewhere):
-- a Hævning, a Frikøb, a Konkurrence and a Betalingsmelding that afventer.
select tests.log_ud();
insert into public.haevning (bodekasse_id, saeson_id, beloeb, formaal, registreret_af)
values (:'kasse', :'foerste', 10, 'Bold', :'mads') returning id as haevning \gset
insert into public.frikob (bodekasse_id, saeson_id, medlem_id, bodekategori_id, registreret_af)
values (:'kasse', :'foerste', :'jonas', :'for_sent', :'mads') returning id as frikob \gset
insert into public.konkurrence (bodekasse_id, saeson_id, titel, oprettet_af)
values (:'kasse', :'foerste', 'Bowling', :'mads') returning id as konkurrence \gset
insert into public.betalingsmelding (bodekasse_id, saeson_id, medlem_id, beloeb)
values (:'kasse', :'foerste', :'jonas', 15) returning id as melding \gset
insert into public.gebyr (bodekasse_id, saeson_id, medlem_id, art, beloeb, bodekategori_id)
values (:'kasse', :'foerste', :'mads', 'oprettelse', 50, :'for_sent') returning id as gebyr \gset
select id as bode from public.bode where batch_id = :'batch' \gset
select tests.log_ind_som_medlem(:'mads');

-- The next Sæson starts.
select public.start_saeson(gen_random_uuid(), :'kasse') ->> 'saeson_id' as anden \gset

-- ---------- No write RPC accepts a past Sæson's records ----------
select throws_ok(
  format($$ select public.fortryd_batch(gen_random_uuid(), %L) $$, :'batch'),
  'P0001', 'tidligere_saeson', 'a Giv batch from a past Sæson cannot be undone, even within the window');

select throws_ok(
  format($$ select public.annuller_indbetaling(gen_random_uuid(), %L) $$, :'gammel_betaling'),
  'P0001', 'tidligere_saeson', 'an Indbetaling from a past Sæson cannot be annulled');

select throws_ok(
  format($$ select public.annuller_haevning(gen_random_uuid(), %L) $$, :'haevning'),
  'P0001', 'tidligere_saeson', 'a Hævning from a past Sæson cannot be annulled');

select throws_ok(
  format($$ select public.annuller_frikob(gen_random_uuid(), %L) $$, :'frikob'),
  'P0001', 'tidligere_saeson', 'a Frikøb from a past Sæson cannot be annulled');

select throws_ok(
  format($$ select public.ret_konkurrence(gen_random_uuid(), %L, 'Bowling', current_date, '[]'::jsonb) $$,
         :'konkurrence'),
  'P0001', 'tidligere_saeson', 'a Konkurrence from a past Sæson cannot be corrected');

select throws_ok(
  format($$ select public.annuller_konkurrence(gen_random_uuid(), %L) $$, :'konkurrence'),
  'P0001', 'tidligere_saeson', 'a Konkurrence from a past Sæson cannot be annulled');

select throws_ok(
  format($$ select public.annuller_bode(gen_random_uuid(), %L) $$, :'bode'),
  'P0001', 'tidligere_saeson', 'a Bøde from a past Sæson cannot be annulled');

select throws_ok(
  format($$ select public.annuller_gebyr(gen_random_uuid(), %L) $$, :'gebyr'),
  'P0001', 'tidligere_saeson', 'a Gebyr from a past Sæson cannot be annulled');

select results_eq(
  format($$ select (select count(*) from public.bode where batch_id = %L and annulleret is null),
                   (select count(*) from public.indbetaling where id = %L and annulleret is null) $$,
         :'batch', :'gammel_betaling'),
  $$ values (1::bigint, 1::bigint) $$,
  'the past Sæson''s Bøde and Indbetaling are untouched');

-- ---------- "Overført fra sidste sæson" ----------
select results_eq(
  format($$ select boeder_i_alt, indbetalt, overfoert from public.medlem_saeson_tal
             where saeson_id = %L and medlem_id = %L $$, :'anden', :'jonas'),
  $$ values (0, 0, 30) $$,
  'the new Sæson starts at 0 with the 30 kr Jonas still owed carried over');

-- ---------- Payments toward old debt go in the current Sæson ----------
select public.registrer_indbetaling(gen_random_uuid(), :'kasse', :'jonas', 30) ->> 'indbetaling_id' as ny_betaling \gset

select is(
  (select saeson_id from public.indbetaling where id = :'ny_betaling'),
  :'anden'::uuid,
  'paying old debt is recorded in the current Sæson');

select results_eq(
  format($$ select boeder_i_alt, indbetalt, overfoert from public.medlem_saeson_tal
             where saeson_id = %L and medlem_id = %L $$, :'anden', :'jonas'),
  $$ values (0, 30, 30) $$,
  'the payment counts as Indbetalt in the current Sæson');

select results_eq(
  format($$ select boeder_i_alt, indbetalt from public.medlem_saeson_tal
             where saeson_id = %L and medlem_id = %L $$, :'foerste', :'jonas'),
  $$ values (50, 20) $$,
  'the past Sæson''s figures stay as they were');

select is(
  (select saldo from public.medlem_saldo where medlem_id = :'jonas'),
  0,
  'the payment clears Jonas''s Saldo');

select results_eq(
  format($$ select indbetalt from public.topliste where saeson_id = %L and medlem_id = %L $$,
         :'foerste', :'jonas'),
  $$ values (20) $$,
  'the past Sæson''s Topliste does not change');

-- A report from last Sæson, confirmed now, is a payment in the current Sæson.
select public.behandl_betalingsmelding(gen_random_uuid(), :'melding', true) ->> 'indbetaling_id' as fra_melding \gset
select is(
  (select saeson_id from public.indbetaling where id = :'fra_melding'),
  :'anden'::uuid,
  'confirming last Sæson''s Betalingsmelding records the payment in the current Sæson');

select * from finish();
rollback;
