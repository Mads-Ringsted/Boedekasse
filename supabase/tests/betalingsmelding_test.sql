-- Betalingsmelding (#60): a Medlem reports "Jeg har betalt"; another Medlem
-- confirms or rejects it (an Admin may confirm their own). Confirming creates
-- exactly one Indbetaling with the reported amount. The reporter can withdraw
-- it while it afventer. No feed entry while it afventer. Works in a Pause.
begin;
\ir _hjaelpere.psql
select plan(22);

select tests.opret_bodekasse() as kasse \gset
select tests.opret_medlem_med_login(:'kasse', 'Anna', true) as anna \gset
select tests.opret_medlem_med_login(:'kasse', 'Bo') as bo \gset
select tests.opret_medlem_med_login(:'kasse', 'Cille') as cille \gset
select tests.giv_bode(:'anna', :'bo', 120);
select private.seneste_saeson(:'kasse') as s1 \gset

-- ---------- Reporting ----------

-- Bo reports 85 kr: it afventer, in the latest Sæson, and the money hasn't moved.
select tests.log_ind_som_medlem(:'bo');
select public.meld_betaling(gen_random_uuid(), :'kasse', 85) ->> 'betalingsmelding_id' as m1 \gset
select results_eq(
  format($$ select medlem_id, beloeb, status::text, saeson_id from public.betalingsmelding where id = %L $$, :'m1'),
  format($$ values (%L::uuid, 85, 'afventer', %L::uuid) $$, :'bo', :'s1'),
  'a report afventer, with the reporter, the amount and the latest Sæson');
select results_eq(
  format($$ select (select saldo from public.medlem_saldo where medlem_id = %L),
                   (select count(*)::int from public.indbetaling) $$, :'bo'),
  $$ values (120, 0) $$,
  'a report that afventer does not change the Saldo or make an Indbetaling');
select is_empty(
  format($$ select 1 from public.haendelse where ref_id = %L or modtager_id = %L $$, :'m1', :'bo'),
  'a report that afventer has no feed entry');

select throws_ok(
  format($$ select public.meld_betaling(gen_random_uuid(), %L, 10) $$, :'kasse'),
  'P0001', 'melding_afventer', 'a Medlem has one report afventer at a time');
select tests.log_ind_som_medlem(:'cille');
select throws_ok(
  format($$ select public.meld_betaling(gen_random_uuid(), %L, 0) $$, :'kasse'),
  'P0001', 'beloeb_ugyldig', 'the amount must be over 0 kr');

-- ---------- Confirming ----------

-- Bo can't confirm his own report: he isn't an Admin.
select tests.log_ind_som_medlem(:'bo');
select throws_ok(
  format($$ select public.behandl_betalingsmelding(gen_random_uuid(), %L, true) $$, :'m1'),
  'P0001', 'egen_melding', 'the reporter cannot confirm their own report unless Admin');
select throws_ok(
  format($$ select public.behandl_betalingsmelding(gen_random_uuid(), %L, false) $$, :'m1'),
  'P0001', 'egen_melding', '... nor reject it');

-- Cille (a plain Medlem) confirms it, with a one-time ID she then repeats.
select tests.log_ind_som_medlem(:'cille');
select gen_random_uuid() as k1 \gset
select public.behandl_betalingsmelding(:'k1', :'m1', true) as svar1 \gset
select is(
  public.behandl_betalingsmelding(:'k1', :'m1', true), :'svar1'::jsonb,
  'a repeat with the same one-time ID returns the first answer');
select throws_ok(
  format($$ select public.behandl_betalingsmelding(gen_random_uuid(), %L, true) $$, :'m1'),
  'P0001', 'ikke_afventer', 'a report can only be handled while it afventer');

select results_eq(
  format($$ select medlem_id, beloeb, registreret_af, saeson_id from public.indbetaling
             where betalingsmelding_id = %L $$, :'m1'),
  format($$ values (%L::uuid, 85, %L::uuid, %L::uuid) $$, :'bo', :'cille', :'s1'),
  'confirming creates exactly one Indbetaling with the reported amount, registered by the confirmer');
select results_eq(
  format($$ select status::text, behandlet_af, behandlet is not null from public.betalingsmelding where id = %L $$, :'m1'),
  format($$ values ('bekraeftet', %L::uuid, true) $$, :'cille'),
  'the report is marked bekraeftet by the confirmer');
select results_eq(
  format($$ select saldo from public.medlem_saldo where medlem_id = %L $$, :'bo'),
  $$ values (35) $$,
  'the confirmed amount counts against the Saldo');
select is(
  :'svar1'::jsonb ->> 'indbetaling_id',
  (select id::text from public.indbetaling where betalingsmelding_id = :'m1'),
  'the answer names the new Indbetaling');
select results_eq(
  format($$ select art, aktoer_id, modtager_id, ref_tabel, data->>'navn', (data->>'beloeb')::int
             from public.haendelse where modtager_id = %L $$, :'bo'),
  format($$ values ('betaling_bekraeftet', %L::uuid, %L::uuid, 'indbetaling', 'Bo', 85) $$, :'cille', :'bo'),
  'confirming adds one feed entry pointing at the Indbetaling (so an annulment strikes it)');

-- An Admin may confirm their own report.
select tests.log_ind_som_medlem(:'anna');
select public.meld_betaling(gen_random_uuid(), :'kasse', 40) ->> 'betalingsmelding_id' as m2 \gset
select public.behandl_betalingsmelding(gen_random_uuid(), :'m2', true);
select results_eq(
  format($$ select medlem_id, registreret_af, beloeb from public.indbetaling where betalingsmelding_id = %L $$, :'m2'),
  format($$ values (%L::uuid, %L::uuid, 40) $$, :'anna', :'anna'),
  'an Admin can confirm their own report');

-- ---------- Rejecting ----------

select tests.log_ind_som_medlem(:'cille');
select public.meld_betaling(gen_random_uuid(), :'kasse', 50) ->> 'betalingsmelding_id' as m3 \gset
select tests.log_ind_som_medlem(:'bo');
select public.behandl_betalingsmelding(gen_random_uuid(), :'m3', false);
select results_eq(
  format($$ select m.status::text, m.behandlet_af, (select count(*)::int from public.indbetaling i
                                                     where i.betalingsmelding_id = m.id)
             from public.betalingsmelding m where m.id = %L $$, :'m3'),
  format($$ values ('afvist', %L::uuid, 0) $$, :'bo'),
  'rejecting marks the report afvist and makes no Indbetaling');
select results_eq(
  format($$ select art, aktoer_id, modtager_id, ref_tabel, (data->>'beloeb')::int
             from public.haendelse where modtager_id = %L $$, :'cille'),
  format($$ values ('betaling_afvist', %L::uuid, %L::uuid, null::text, 50) $$, :'bo', :'cille'),
  'rejecting adds a feed entry');

-- ---------- Withdrawing ----------

select tests.log_ind_som_medlem(:'cille');
select public.meld_betaling(gen_random_uuid(), :'kasse', 30) ->> 'betalingsmelding_id' as m4 \gset
select tests.log_ind_som_medlem(:'anna');
select throws_ok(
  format($$ select public.fortryd_betalingsmelding(gen_random_uuid(), %L) $$, :'m4'),
  'P0001', 'ikke_din_melding', 'only the reporter can withdraw a report, Admins included');
select tests.log_ind_som_medlem(:'cille');
select public.fortryd_betalingsmelding(gen_random_uuid(), :'m4');
select results_eq(
  format($$ select status::text from public.betalingsmelding where id = %L $$, :'m4'),
  $$ values ('trukket') $$,
  'the reporter withdraws a report that afventer');
select throws_ok(
  format($$ select public.fortryd_betalingsmelding(gen_random_uuid(), %L) $$, :'m3'),
  'P0001', 'ikke_afventer', 'a report can only be withdrawn while it afventer');

-- ---------- Another box, and a Pause ----------

select tests.log_ud();
select tests.opret_bodekasse('Anden') as anden \gset
select tests.opret_medlem_med_login(:'anden', 'Fremmed', true) as fremmed \gset
select tests.log_ind_som_medlem(:'fremmed');
select throws_ok(
  format($$ select public.behandl_betalingsmelding(gen_random_uuid(), %L, true) $$, :'m1'),
  '42501', 'ikke_medlem', 'someone outside the box cannot handle its reports');

select tests.log_ud();
update public.saeson set afsluttet = now() where id = :'s1';
select tests.log_ind_som_medlem(:'bo');
select public.meld_betaling(gen_random_uuid(), :'kasse', 35) ->> 'betalingsmelding_id' as m5 \gset
select tests.log_ind_som_medlem(:'cille');
select public.behandl_betalingsmelding(gen_random_uuid(), :'m5', true);
select results_eq(
  format($$ select saeson_id, beloeb from public.indbetaling where betalingsmelding_id = %L $$, :'m5'),
  format($$ values (%L::uuid, 35) $$, :'s1'),
  'in a Pause a report can be made and confirmed, in the latest Sæson');

select * from finish();
rollback;
