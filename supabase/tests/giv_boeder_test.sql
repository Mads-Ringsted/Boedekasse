-- Giv bøder: one submit is one batch with kept prices in the running Sæson,
-- and one feed entry per receiver. Fortryd removes the whole batch.
begin;
\ir _hjaelpere.psql
select plan(25);

select tests.opret_bodekasse('Kasse A') as kasse \gset
select tests.opret_medlem_med_login(:'kasse', 'Jonas Holm') as jonas \gset
select tests.opret_medlem_med_login(:'kasse', 'Emil Bach') as emil \gset
select tests.opret_medlem_med_login(:'kasse', 'Kasper Nørgaard') as kasper \gset
select tests.opret_bodekategori(:'jonas', 'For sent', 50) as for_sent \gset
select tests.opret_bodekategori(:'jonas', 'Spildt drikke', 20) as spildt \gset

-- ---------- Giv ----------
-- One line: this many Bøder of one Bødekategori to one receiver.
create function tests.linje(p_modtager uuid, p_kategori uuid, p_antal int default 1)
returns jsonb language sql as $$
  select jsonb_build_object('modtager_id', p_modtager, 'bodekategori_id', p_kategori, 'antal', p_antal)
$$;
grant execute on function tests.linje(uuid, uuid, int) to authenticated;

select tests.log_ind_som_medlem(:'jonas');
select public.giv_boeder(gen_random_uuid(), :'kasse', jsonb_build_array(
  tests.linje(:'emil', :'for_sent', 2),
  tests.linje(:'emil', :'spildt'),
  tests.linje(:'kasper', :'for_sent'))) as svar \gset

select is(:'svar'::jsonb - 'batch_id', '{"antal": 4, "beloeb": 170}'::jsonb,
  'giving answers with the number of Bøder and the total');
select (:'svar'::jsonb ->> 'batch_id')::uuid as batch \gset

select results_eq(
  format($$ select modtager_id, pris, count(*)::int from public.bode
             where batch_id = %L group by 1, 2 order by 3, 2 $$, :'batch'),
  format($$ values (%1$L::uuid, 20, 1), (%2$L::uuid, 50, 1), (%1$L::uuid, 50, 2) $$, :'emil', :'kasper'),
  'one submit is one batch: each count becomes that many Bøder');

select is(
  (select count(*)::int from public.bode b join public.bodekasse_saeson s using (bodekasse_id)
    where b.batch_id = :'batch' and b.saeson_id = s.aktiv_saeson_id and b.giver_id = :'jonas'),
  4, 'every Bøde has the giver and the running Sæson');

select results_eq(
  format($$ select modtager_id, aktoer_id, art, data from public.haendelse
             where batch_id = %L order by (data ->> 'antal')::int desc $$, :'batch'),
  format($$ values
    (%1$L::uuid, %3$L::uuid, 'boeder_givet', jsonb_build_object('antal', 3, 'beloeb', 120, 'linjer', jsonb_build_array(
       jsonb_build_object('navn', 'For sent', 'pris', 50, 'antal', 2, 'bodekategori_id', %4$L::uuid),
       jsonb_build_object('navn', 'Spildt drikke', 'pris', 20, 'antal', 1, 'bodekategori_id', %5$L::uuid)))),
    (%2$L::uuid, %3$L::uuid, 'boeder_givet', jsonb_build_object('antal', 1, 'beloeb', 50, 'linjer', jsonb_build_array(
       jsonb_build_object('navn', 'For sent', 'pris', 50, 'antal', 1, 'bodekategori_id', %4$L::uuid))))
  $$, :'emil', :'kasper', :'jonas', :'for_sent', :'spildt'),
  'one feed entry per receiver, with the Bøder it holds');

-- A new price later never changes a given Bøde.
select public.ret_bodekategori(gen_random_uuid(), :'for_sent', 'For sent', 75, null);
select is((select saldo from public.medlem_saldo where medlem_id = :'emil'), 120,
  'Bøder keep the price they were given at; the receiver owes it');

-- Prøv igen with the same one-time ID.
select gen_random_uuid() as id_igen \gset
select public.giv_boeder(:'id_igen', :'kasse', jsonb_build_array(tests.linje(:'kasper', :'spildt')))
  as svar_igen \gset
select is(public.giv_boeder(:'id_igen', :'kasse', jsonb_build_array(tests.linje(:'kasper', :'spildt'))),
  :'svar_igen'::jsonb, 'repeating the same one-time ID returns the first answer');
select is((select count(*)::int from public.bode where modtager_id = :'kasper'), 2,
  'repeating the same one-time ID gives nothing new');

-- ---------- Rules ----------
select throws_ok(
  format($$ select public.giv_boeder(gen_random_uuid(), %L, '[]') $$, :'kasse'),
  'P0001', 'ingen_boeder', 'a submit needs at least one Bøde');

select throws_ok(
  format($$ select public.giv_boeder(gen_random_uuid(), %L, jsonb_build_array(tests.linje(%L, %L, 0))) $$,
         :'kasse', :'emil', :'for_sent'),
  'P0001', 'antal_ugyldig', 'a count must be at least 1');

-- You can give yourself a Bøde; you bear it like any other.
select public.giv_boeder(gen_random_uuid(), :'kasse', jsonb_build_array(tests.linje(:'jonas', :'for_sent')))
  ->> 'batch_id' as selv_batch \gset
select results_eq(
  format($$ select giver_id, modtager_id, pris from public.bode where batch_id = %L $$, :'selv_batch'),
  format($$ values (%1$L::uuid, %1$L::uuid, 75) $$, :'jonas'),
  'you can give yourself a Bøde');
select is((select saldo from public.medlem_saldo where medlem_id = :'jonas'), 75,
  'you bear the Bøde you gave yourself');

-- The whole submit fails on one bad line: nothing is given.
select tests.opret_bodekasse('Kasse B') as kasse_b \gset
select tests.opret_medlem_med_login(:'kasse_b', 'Fremmed') as fremmed \gset
select tests.opret_bodekategori(:'fremmed', 'Fremmed kategori', 10) as fremmed_kategori \gset
select throws_ok(
  format($$ select public.giv_boeder(gen_random_uuid(), %L, jsonb_build_array(tests.linje(%L, %L), tests.linje(%L, %L))) $$,
         :'kasse', :'emil', :'spildt', :'fremmed', :'for_sent'),
  'P0001', 'modtager_ukendt', 'a receiver from another box is rejected');
select is((select count(*)::int from public.bode where modtager_id = :'emil'), 3,
  'a rejected submit gives none of its Bøder');

select throws_ok(
  format($$ select public.giv_boeder(gen_random_uuid(), %L, jsonb_build_array(tests.linje(%L, %L))) $$,
         :'kasse', :'emil', :'fremmed_kategori'),
  'P0001', 'ikke_fundet', 'a Bødekategori from another box is rejected');

select tests.log_ud();
update public.bodekategori set arkiveret = now() where id = :'spildt';
update public.medlem set udmeldt = now() where id = :'kasper';
select tests.log_ind_som_medlem(:'jonas');

select throws_ok(
  format($$ select public.giv_boeder(gen_random_uuid(), %L, jsonb_build_array(tests.linje(%L, %L))) $$,
         :'kasse', :'emil', :'spildt'),
  'P0001', 'arkiveret', 'an archived Bødekategori cannot be given');

select throws_ok(
  format($$ select public.giv_boeder(gen_random_uuid(), %L, jsonb_build_array(tests.linje(%L, %L))) $$,
         :'kasse', :'kasper', :'for_sent'),
  'P0001', 'modtager_udmeldt', 'an Udmeldt Medlem cannot get a Bøde');

select tests.log_ind_som_medlem(:'fremmed');
select throws_ok(
  format($$ select public.giv_boeder(gen_random_uuid(), %L, jsonb_build_array(tests.linje(%L, %L))) $$,
         :'kasse', :'emil', :'for_sent'),
  '42501', 'ikke_medlem', 'a non-Medlem cannot give Bøder in the box');

-- In a Pause (the Sæson ended): no giving.
select tests.log_ud();
update public.saeson set afsluttet = now() where bodekasse_id = :'kasse';
select tests.log_ind_som_medlem(:'jonas');
select throws_ok(
  format($$ select public.giv_boeder(gen_random_uuid(), %L, jsonb_build_array(tests.linje(%L, %L))) $$,
         :'kasse', :'emil', :'for_sent'),
  'P0001', 'pause', 'giving needs a running Sæson');
select tests.log_ud();
update public.saeson set afsluttet = null where bodekasse_id = :'kasse';

-- ---------- Fortryd ----------
select tests.log_ind_som_medlem(:'jonas');
select public.giv_boeder(gen_random_uuid(), :'kasse', jsonb_build_array(tests.linje(:'emil', :'for_sent', 2)))
  ->> 'batch_id' as fortryd_batch \gset

select tests.log_ind_som_medlem(:'emil');
select throws_ok(
  format($$ select public.fortryd_batch(gen_random_uuid(), %L) $$, :'fortryd_batch'),
  '42501', 'ikke_tilladt', 'only the giver can Fortryd a batch');

select tests.log_ind_som_medlem(:'jonas');
select gen_random_uuid() as fortryd_id \gset
select public.fortryd_batch(:'fortryd_id', :'fortryd_batch') as fortryd_svar \gset
select is(
  (select count(*)::int from public.bode where batch_id = :'fortryd_batch')
  + (select count(*)::int from public.haendelse where batch_id = :'fortryd_batch'),
  0, 'Fortryd removes every Bøde of the batch and its feed entries');
select is((select saldo from public.medlem_saldo where medlem_id = :'emil'), 120,
  'after Fortryd the receiver owes what they owed before');
select is(public.fortryd_batch(:'fortryd_id', :'fortryd_batch'), :'fortryd_svar'::jsonb,
  'repeating Fortryd with the same one-time ID returns the first answer');
select throws_ok(
  format($$ select public.fortryd_batch(gen_random_uuid(), %L) $$, :'fortryd_batch'),
  'P0001', 'ikke_fundet', 'a batch that is gone cannot be undone again');

-- After the short grace, the batch stays (annul it instead).
select public.giv_boeder(gen_random_uuid(), :'kasse', jsonb_build_array(tests.linje(:'emil', :'for_sent')))
  ->> 'batch_id' as gammel_batch \gset
select tests.log_ud();
update public.bode set givet = now() - interval '25 seconds' where batch_id = :'gammel_batch';
select tests.log_ind_som_medlem(:'jonas');
select lives_ok(
  format($$ select public.fortryd_batch(gen_random_uuid(), %L) $$, :'gammel_batch'),
  'Fortryd works a little after the 8-second toast (slow network)');

select public.giv_boeder(gen_random_uuid(), :'kasse', jsonb_build_array(tests.linje(:'emil', :'for_sent')))
  ->> 'batch_id' as gammel_batch \gset
select tests.log_ud();
update public.bode set givet = now() - interval '2 minutes' where batch_id = :'gammel_batch';
select tests.log_ind_som_medlem(:'jonas');
select throws_ok(
  format($$ select public.fortryd_batch(gen_random_uuid(), %L) $$, :'gammel_batch'),
  'P0001', 'fortryd_udloebet', 'Fortryd is refused after the grace');

select * from finish();
rollback;
