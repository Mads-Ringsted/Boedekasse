-- Annulling an Indbetaling (#59): Admin only, optional note, once; allowed in
-- the latest Sæson until the next one starts (Pause included), never in a
-- past Sæson. The row stays (greyed, struck through) but stops counting.
begin;
\ir _hjaelpere.psql
select plan(8);

select tests.opret_bodekasse() as kasse \gset
select tests.opret_medlem_med_login(:'kasse', 'Anna', true) as anna \gset
select tests.opret_medlem_med_login(:'kasse', 'Bo') as bo \gset
select tests.giv_bode(:'anna', :'bo', 100);

select tests.log_ind_som_medlem(:'anna');
select public.registrer_indbetaling(gen_random_uuid(), :'kasse', :'bo', 80) ->> 'indbetaling_id' as i1 \gset

-- Anna annuls it: Bo owes 100 again and Kassen is empty.
select public.annuller_indbetaling(gen_random_uuid(), :'i1', ' Forkert person ');
select results_eq(
  format($$ select (select saldo from public.medlem_saldo where medlem_id = %L),
                   (select beloeb from public.kassen),
                   (select annulleret_af from public.indbetaling where id = %L),
                   (select annulleret_note from public.indbetaling where id = %L) $$, :'bo', :'i1', :'i1'),
  format($$ values (100, 0, %L::uuid, 'Forkert person') $$, :'anna'),
  'an annulled Indbetaling stays, marked with who and the note, and leaves Saldo and Kassen');

select results_eq(
  $$ select art, aktoer_id, modtager_id, ref_id, data->>'indbetaling_id', (data->>'beloeb')::int, data->>'note'
       from public.haendelse where art = 'indbetaling_annulleret' $$,
  format($$ values ('indbetaling_annulleret', %L::uuid, %L::uuid, null::uuid, %L, 80, 'Forkert person') $$,
         :'anna', :'bo', :'i1'),
  'the annulment adds its own feed row, not pointing at the Indbetaling as its subject');

select results_eq(
  $$ select art, annulleret is not null, annulleret_note from public.aktivitet order by id $$,
  $$ values ('indbetaling', true, 'Forkert person'), ('indbetaling_annulleret', false, null) $$,
  'the feed shows the Indbetaling struck through and the annulment as a plain new row');

select throws_ok(
  format($$ select public.annuller_indbetaling(gen_random_uuid(), %L) $$, :'i1'),
  'P0001', 'allerede_annulleret', 'an Indbetaling cannot be annulled twice');

-- A retry with the same one-time ID returns the first answer.
select public.registrer_indbetaling(gen_random_uuid(), :'kasse', :'bo', 30) ->> 'indbetaling_id' as i2 \gset
select gen_random_uuid() as gentag \gset
select public.annuller_indbetaling(:'gentag', :'i2') as svar1 \gset
select is(public.annuller_indbetaling(:'gentag', :'i2'), :'svar1'::jsonb,
  'a repeat with the same one-time ID returns the first answer instead of failing');

-- Only Admins.
select public.registrer_indbetaling(gen_random_uuid(), :'kasse', :'bo', 40) ->> 'indbetaling_id' as i3 \gset
select tests.log_ind_som_medlem(:'bo');
select throws_ok(
  format($$ select public.annuller_indbetaling(gen_random_uuid(), %L) $$, :'i3'),
  '42501', 'ikke_admin', 'a plain Medlem cannot annul an Indbetaling');

-- In a Pause the ended Sæson is still the latest, so annulling works.
select tests.log_ud();
select private.seneste_saeson(:'kasse') as s1 \gset
update public.saeson set afsluttet = now() where id = :'s1';
select tests.log_ind_som_medlem(:'anna');
select public.annuller_indbetaling(gen_random_uuid(), :'i3');
select results_eq(
  format($$ select annulleret is not null from public.indbetaling where id = %L $$, :'i3'),
  $$ values (true) $$,
  'an Admin can annul an Indbetaling in a Pause');

-- Once the next Sæson starts, the old one is read-only.
select public.registrer_indbetaling(gen_random_uuid(), :'kasse', :'bo', 20) ->> 'indbetaling_id' as i4 \gset
select tests.log_ud();
insert into public.saeson (bodekasse_id, navn) values (:'kasse', 'Sæson 2');
select tests.log_ind_som_medlem(:'anna');
select throws_ok(
  format($$ select public.annuller_indbetaling(gen_random_uuid(), %L) $$, :'i4'),
  'P0001', 'tidligere_saeson', 'an Indbetaling from a past Sæson cannot be annulled');

select * from finish();
rollback;
