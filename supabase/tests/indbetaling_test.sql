-- Registrér indbetaling and annulling an Indbetaling (#59): Admin only, any
-- Medlem incl. yourself and Udmeldte, counts against the whole Saldo, works
-- in a Pause; annul only in the latest Sæson.
begin;
\ir _hjaelpere.psql
select plan(10);

select tests.opret_bodekasse() as kasse \gset
select tests.opret_medlem_med_login(:'kasse', 'Anna', true) as anna \gset
select tests.opret_medlem_med_login(:'kasse', 'Bo') as bo \gset
select tests.giv_bode(:'anna', :'bo', 120);

-- Anna (Admin) registers 80 kr from Bo: he owes 40, the box holds 80.
select tests.log_ind_som_medlem(:'anna');
select public.registrer_indbetaling(gen_random_uuid(), :'kasse', :'bo', 80, 'Kontant');

select results_eq(
  format($$ select (select saldo from public.medlem_saldo where medlem_id = %L),
                   (select beloeb from public.kassen) $$, :'bo'),
  $$ values (40, 80) $$,
  'an Indbetaling lowers the Medlem''s Saldo and fills Kassen');

-- Too much leaves Til gode: Bo pays 100 more and has 60 kr til gode.
select public.registrer_indbetaling(gen_random_uuid(), :'kasse', :'bo', 100);
select results_eq(
  format($$ select saldo from public.medlem_saldo where medlem_id = %L $$, :'bo'),
  $$ values (-60) $$,
  'paying more than you owe leaves Til gode (negative Saldo)');

-- Yourself and Udmeldte too.
select tests.log_ud();
select tests.opret_medlem_med_login(:'kasse', 'Udo') as udo \gset
select tests.giv_bode(:'anna', :'udo', 30);
update public.medlem set udmeldt = now() where id = :'udo';
select tests.log_ind_som_medlem(:'anna');
select public.registrer_indbetaling(gen_random_uuid(), :'kasse', :'anna', 25);
select public.registrer_indbetaling(gen_random_uuid(), :'kasse', :'udo', 30);
select results_eq(
  format($$ select medlem_id, saldo from public.medlem_saldo
             where medlem_id in (%L, %L) order by saldo $$, :'anna', :'udo'),
  format($$ values (%L::uuid, -25), (%L::uuid, 0) $$, :'anna', :'udo'),
  'an Admin registers an Indbetaling for themself and for an Udmeldt Medlem');

-- The feed row: "+80 kr" from Bo, registered by Anna, with the note.
select results_eq(
  format($$ select art, aktoer_id, modtager_id, data->>'navn', (data->>'beloeb')::int, data->>'note'
             from public.haendelse where ref_tabel = 'indbetaling' and modtager_id = %L
            order by id limit 1 $$, :'bo'),
  format($$ values ('indbetaling', %L::uuid, %L::uuid, 'Bo', 80, 'Kontant') $$, :'anna', :'bo'),
  'each Indbetaling adds a feed row with who paid, how much and the note');

-- A retry with the same one-time ID does not pay twice.
select gen_random_uuid() as gentag \gset
select public.registrer_indbetaling(:'gentag', :'kasse', :'bo', 10) as svar1 \gset
select is(
  public.registrer_indbetaling(:'gentag', :'kasse', :'bo', 10), :'svar1'::jsonb,
  'a repeat with the same one-time ID returns the first answer');
select results_eq(
  format($$ select saldo from public.medlem_saldo where medlem_id = %L $$, :'bo'),
  $$ values (-70) $$,
  '... and records the Indbetaling only once');

-- Only Admins; amounts are whole kroner over 0; the Medlem must be in the box.
select tests.log_ind_som_medlem(:'bo');
select throws_ok(
  format($$ select public.registrer_indbetaling(gen_random_uuid(), %L, %L, 50) $$, :'kasse', :'bo'),
  '42501', 'ikke_admin', 'a plain Medlem cannot register an Indbetaling');

select tests.log_ud();
select tests.opret_bodekasse('Anden') as anden \gset
select tests.opret_medlem_med_login(:'anden', 'Fremmed', true) as fremmed \gset
select tests.log_ind_som_medlem(:'anna');
select throws_ok(
  format($$ select public.registrer_indbetaling(gen_random_uuid(), %L, %L, 50) $$, :'kasse', :'fremmed'),
  'P0001', 'medlem_ukendt', 'the payer must be a Medlem of the box');
select throws_ok(
  format($$ select public.registrer_indbetaling(gen_random_uuid(), %L, %L, 0) $$, :'kasse', :'bo'),
  'P0001', 'beloeb_ugyldig', 'the amount must be over 0 kr');

-- A Pause: the Sæson has ended, and an Indbetaling still lands in it.
select tests.log_ud();
select private.seneste_saeson(:'kasse') as s1 \gset
update public.saeson set afsluttet = now() where id = :'s1';
select tests.log_ind_som_medlem(:'anna');
select public.registrer_indbetaling(gen_random_uuid(), :'kasse', :'bo', 5) ->> 'indbetaling_id' as i_pause \gset
select results_eq(
  format($$ select saeson_id from public.indbetaling where id = %L $$, :'i_pause'),
  format($$ values (%L::uuid) $$, :'s1'),
  'in a Pause an Indbetaling works and gets the latest Sæson''s id');

select * from finish();
rollback;
