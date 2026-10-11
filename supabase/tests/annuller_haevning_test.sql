-- Annulling a Hævning (#61): Admin only, optional note, once; allowed in the
-- latest Sæson until the next one starts (Pause included), never in a past
-- Sæson. The row stays (greyed, struck through), and the money is back in Kassen.
begin;
\ir _hjaelpere.psql
select plan(7);

select tests.opret_bodekasse() as kasse \gset
select tests.opret_medlem_med_login(:'kasse', 'Anna', true) as anna \gset
select tests.opret_medlem_med_login(:'kasse', 'Bo') as bo \gset

select tests.log_ind_som_medlem(:'anna');
select public.registrer_indbetaling(gen_random_uuid(), :'kasse', :'bo', 100);
select public.haev(gen_random_uuid(), :'kasse', 60, 'Bowling') ->> 'haevning_id' as h1 \gset

-- Anna annuls it: the box holds 100 again.
select public.annuller_haevning(gen_random_uuid(), :'h1', ' Forkert beløb ');
select results_eq(
  format($$ select (select beloeb from public.kassen),
                   (select annulleret_af from public.haevning where id = %L),
                   (select annulleret_note from public.haevning where id = %L) $$, :'h1', :'h1'),
  format($$ values (100, %L::uuid, 'Forkert beløb') $$, :'anna'),
  'an annulled Hævning stays, marked with who and the note, and its money is back in Kassen');

select results_eq(
  $$ select art, annulleret is not null, annulleret_note, data->>'formaal', (data->>'beloeb')::int
       from public.aktivitet where art in ('haevning', 'haevning_annulleret') order by id $$,
  $$ values ('haevning', true, 'Forkert beløb', 'Bowling', 60),
            ('haevning_annulleret', false, null, 'Bowling', 60) $$,
  'the feed shows the Hævning struck through and the annulment as a plain new row');

select throws_ok(
  format($$ select public.annuller_haevning(gen_random_uuid(), %L) $$, :'h1'),
  'P0001', 'allerede_annulleret', 'a Hævning cannot be annulled twice');

-- A retry with the same one-time ID returns the first answer.
select public.haev(gen_random_uuid(), :'kasse', 20, 'Øl') ->> 'haevning_id' as h2 \gset
select gen_random_uuid() as gentag \gset
select public.annuller_haevning(:'gentag', :'h2') as svar1 \gset
select is(public.annuller_haevning(:'gentag', :'h2'), :'svar1'::jsonb,
  'a repeat with the same one-time ID returns the first answer instead of failing');

-- Only Admins.
select public.haev(gen_random_uuid(), :'kasse', 40, 'Pokal') ->> 'haevning_id' as h3 \gset
select tests.log_ind_som_medlem(:'bo');
select throws_ok(
  format($$ select public.annuller_haevning(gen_random_uuid(), %L) $$, :'h3'),
  '42501', 'ikke_admin', 'a plain Medlem cannot annul a Hævning');

-- In a Pause the ended Sæson is still the latest, so annulling works.
select tests.log_ud();
select private.seneste_saeson(:'kasse') as s1 \gset
update public.saeson set afsluttet = now() where id = :'s1';
select tests.log_ind_som_medlem(:'anna');
select public.annuller_haevning(gen_random_uuid(), :'h3');
select results_eq(
  format($$ select annulleret is not null from public.haevning where id = %L $$, :'h3'),
  $$ values (true) $$,
  'an Admin can annul a Hævning in a Pause');

-- Once the next Sæson starts, the old one is read-only.
select public.haev(gen_random_uuid(), :'kasse', 10, 'Kegler') ->> 'haevning_id' as h4 \gset
select tests.log_ud();
insert into public.saeson (bodekasse_id, navn) values (:'kasse', 'Sæson 2');
select tests.log_ind_som_medlem(:'anna');
select throws_ok(
  format($$ select public.annuller_haevning(gen_random_uuid(), %L) $$, :'h4'),
  'P0001', 'tidligere_saeson', 'a Hævning from a past Sæson cannot be annulled');

select * from finish();
rollback;
