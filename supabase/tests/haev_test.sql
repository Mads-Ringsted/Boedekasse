-- Hæv penge (#61): an Admin takes money out of the box for a purpose. It
-- never exceeds Kassen, never changes a Saldo, and works in a Pause.
begin;
\ir _hjaelpere.psql
select plan(10);

select tests.opret_bodekasse() as kasse \gset
select tests.opret_medlem_med_login(:'kasse', 'Anna', true) as anna \gset
select tests.opret_medlem_med_login(:'kasse', 'Bo') as bo \gset
select tests.giv_bode(:'anna', :'bo', 120);

-- Bo pays 100: he owes 20 and the box holds 100.
select tests.log_ind_som_medlem(:'anna');
select public.registrer_indbetaling(gen_random_uuid(), :'kasse', :'bo', 100);

-- Anna takes out 60 for a deposit: the box holds 40, Bo still owes 20.
select public.haev(gen_random_uuid(), :'kasse', 60, ' Depositum til julefrokost ');
select results_eq(
  format($$ select (select beloeb from public.kassen),
                   (select haevet from public.kassen),
                   (select saldo from public.medlem_saldo where medlem_id = %L),
                   (select formaal from public.haevning) $$, :'bo'),
  $$ values (40, 60, 20, 'Depositum til julefrokost') $$,
  'a Hævning lowers Kassen, keeps its purpose and changes no Saldo');

-- Never more than the box holds; exactly all of it is fine.
select throws_ok(
  format($$ select public.haev(gen_random_uuid(), %L, 41, 'Bowling') $$, :'kasse'),
  'P0001', 'over_kassen', 'a Hævning cannot exceed Kassen');
select results_eq(
  $$ select count(*)::int, (select beloeb from public.kassen) from public.haevning $$,
  $$ values (1, 40) $$,
  '... and a rejected one leaves nothing behind');

-- The feed row: who took how much out, and for what.
select results_eq(
  $$ select art, aktoer_id, modtager_id, ref_tabel, (data->>'beloeb')::int, data->>'formaal'
       from public.haendelse where art = 'haevning' $$,
  format($$ values ('haevning', %L::uuid, null::uuid, 'haevning', 60, 'Depositum til julefrokost') $$, :'anna'),
  'each Hævning adds a feed row with the Admin, the amount and the purpose');

-- A retry with the same one-time ID does not take the money twice.
select gen_random_uuid() as gentag \gset
select public.haev(:'gentag', :'kasse', 10, 'Kegler') as svar1 \gset
select is(public.haev(:'gentag', :'kasse', 10, 'Kegler'), :'svar1'::jsonb,
  'a repeat with the same one-time ID returns the first answer');
select results_eq($$ select beloeb from public.kassen $$, $$ values (30) $$,
  '... and takes the money out only once');

-- A purpose is required, and the amount is whole kroner over 0.
select throws_ok(
  format($$ select public.haev(gen_random_uuid(), %L, 10, '  ') $$, :'kasse'),
  'P0001', 'formaal_mangler', 'a Hævning needs a purpose');
select throws_ok(
  format($$ select public.haev(gen_random_uuid(), %L, 0, 'Øl') $$, :'kasse'),
  'P0001', 'beloeb_ugyldig', 'the amount must be over 0 kr');

-- Only Admins.
select tests.log_ind_som_medlem(:'bo');
select throws_ok(
  format($$ select public.haev(gen_random_uuid(), %L, 10, 'Øl') $$, :'kasse'),
  '42501', 'ikke_admin', 'a plain Medlem cannot make a Hævning');

-- A Pause: the Sæson has ended, and a Hævning still lands in it.
select tests.log_ud();
select (select seneste_saeson_id from public.bodekasse_saeson where bodekasse_id = :'kasse') as s1 \gset
update public.saeson set afsluttet = now() where id = :'s1';
select tests.log_ind_som_medlem(:'anna');
select public.haev(gen_random_uuid(), :'kasse', 30, 'Pokal') ->> 'haevning_id' as h_pause \gset
select results_eq(
  format($$ select saeson_id, (select beloeb from public.kassen) from public.haevning where id = %L $$, :'h_pause'),
  format($$ values (%L::uuid, 0) $$, :'s1'),
  'in a Pause a Hævning works and gets the latest Sæson''s id');

select * from finish();
rollback;
