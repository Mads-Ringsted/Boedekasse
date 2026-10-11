-- The Anke verdict (#64): any Medlem except the giver and the receiver
-- records the group's verdict. The loser bears the Bøde; a won Anke moves it
-- to the giver at the original price, even when the giver is Udmeldt. The
-- Anke Gebyr always stays. The recorder or an Admin can change the verdict
-- until the next Sæson starts.
begin;
\ir _hjaelpere.psql
select plan(25);

select tests.opret_bodekasse() as kasse \gset
select tests.opret_medlem_med_login(:'kasse', 'Anna', true) as anna \gset
select tests.opret_medlem_med_login(:'kasse', 'Bo') as bo \gset
select tests.opret_medlem_med_login(:'kasse', 'Carl') as carl \gset
select tests.opret_medlem_med_login(:'kasse', 'Dan') as dan \gset
select tests.opret_medlem_med_login(:'kasse', 'Eva') as eva \gset
select tests.opret_bodekategori(:'anna', 'For sent', 50) as for_sent \gset

select tests.log_ind_som_medlem(:'anna');
select public.opdater_indstillinger(gen_random_uuid(), :'kasse', '{"anke_til": true}');

-- Bo gives Carl a Bøde; Carl appeals it.
select tests.giv_bode(:'bo', :'carl', p_kategori => :'for_sent') as b1 \gset
select tests.log_ind_som_medlem(:'carl');
select public.indgiv_anke(gen_random_uuid(), :'b1') as svar1 \gset
select :'svar1'::jsonb ->> 'anke_id' as a1, :'svar1'::jsonb ->> 'gebyr' as g1 \gset

-- ---------- Recording the verdict ----------
select tests.log_ind_som_medlem(:'bo');
select throws_ok(
  format($$ select public.afgoer_anke(gen_random_uuid(), %L, 'giver_vandt') $$, :'a1'),
  '42501', 'part_i_anken', 'the giver cannot record the verdict');
select tests.log_ind_som_medlem(:'carl');
select throws_ok(
  format($$ select public.afgoer_anke(gen_random_uuid(), %L, 'modtager_vandt') $$, :'a1'),
  '42501', 'part_i_anken', 'the receiver cannot record the verdict');

select tests.log_ind_som_medlem(:'dan');
select throws_ok(
  format($$ select public.afgoer_anke(gen_random_uuid(), %L, 'ikke_afgjort') $$, :'a1'),
  'P0001', 'afgoerelse_ugyldig', 'a verdict is "Bøden står ved magt" or "Anken vinder"');

select public.afgoer_anke(gen_random_uuid(), :'a1', 'modtager_vandt') as svar \gset
select is(:'svar'::jsonb, jsonb_build_object('anke_id', :'a1'), 'it answers with the Anke');

select results_eq(
  format($$ select afgoerelse::text, afgjort_af, afgjort is not null, aendret
              from public.anke where id = %L $$, :'a1'),
  format($$ values ('modtager_vandt', %L::uuid, true, false) $$, :'dan'),
  'any other Medlem records it: verdict, who and when');

select results_eq(
  format($$ select anket, baerer_id from public.bode_baerer where id = %L $$, :'b1'),
  format($$ values (false, %L::uuid) $$, :'bo'),
  'Anken vinder: the giver bears the Bøde');

select results_eq(
  format($$ select (select saldo from public.medlem_saldo where medlem_id = %L),
                   (select saldo from public.medlem_saldo where medlem_id = %L) $$,
         :'bo', :'carl'),
  format($$ values (50, %s) $$, :'g1'),
  'the giver owes the original price; the receiver still pays the Anke Gebyr');

select results_eq(
  $$ select aktoer_id, modtager_id, ref_tabel, data->>'bode_id', data->>'navn', (data->>'pris')::int,
            data->>'afgoerelse', (data->>'aendret')::boolean, data->>'appellant_id', data->>'appellant_navn'
       from public.haendelse where art = 'anke_afgjort' $$,
  format($$ values (%L::uuid, %L::uuid, 'anke', %L, 'For sent', 50, 'modtager_vandt', false, %L, 'Carl') $$,
         :'dan', :'bo', :'b1', :'carl'),
  'the feed gets an anke_afgjort entry by the recorder, about the giver, pointing at the Anke');

select ok(
  (select involverede @> array[:'dan', :'bo', :'carl']::uuid[]
     from public.aktivitet where art = 'anke_afgjort'),
  'the verdict shows in the recorder''s, the giver''s and the receiver''s history');

select results_eq(
  format($$ select afgjort_af, afgjort_af_navn, afgjort is not null, anke_gebyr
              from public.aktivitet_bode where id = %L $$, :'b1'),
  format($$ values (%L::uuid, 'Dan', true, %s) $$, :'dan', :'g1'),
  'aktivitet_bode shows who decided, when, and the Anke Gebyr');

select tests.log_ind_som_medlem(:'eva');
select throws_ok(
  format($$ select public.afgoer_anke(gen_random_uuid(), %L, 'giver_vandt') $$, :'a1'),
  'P0001', 'allerede_afgjort', 'a verdict is recorded once (changing it is another action)');

select tests.log_ind_som_medlem(:'bo');
select throws_ok(
  format($$ select public.indgiv_anke(gen_random_uuid(), %L) $$, :'b1'),
  '42501', 'ikke_modtager', 'the giver cannot appeal a Bøde moved onto them');

-- A repeat with the same one-time ID returns the first answer.
select tests.giv_bode(:'bo', :'carl', p_kategori => :'for_sent') as b2 \gset
select tests.log_ind_som_medlem(:'carl');
select public.indgiv_anke(gen_random_uuid(), :'b2') ->> 'anke_id' as a2 \gset
select tests.log_ind_som_medlem(:'dan');
select gen_random_uuid() as gentag \gset
select public.afgoer_anke(:'gentag', :'a2', 'giver_vandt') as svar2 \gset
select is(public.afgoer_anke(:'gentag', :'a2', 'giver_vandt'), :'svar2'::jsonb,
  'a repeat with the same one-time ID returns the first answer');
select results_eq(
  format($$ select baerer_id from public.bode_baerer where id = %L $$, :'b2'),
  format($$ values (%L::uuid) $$, :'carl'),
  'Bøden står ved magt: the receiver bears the Bøde');

-- An open Anke on an annulled Bøde ends as "Bøden annulleret": no verdict.
select tests.giv_bode(:'bo', :'carl', p_kategori => :'for_sent') as b3 \gset
select tests.log_ind_som_medlem(:'carl');
select public.indgiv_anke(gen_random_uuid(), :'b3') ->> 'anke_id' as a3 \gset
select tests.log_ind_som_medlem(:'anna');
select public.annuller_bode(gen_random_uuid(), :'b3');
select tests.log_ind_som_medlem(:'dan');
select throws_ok(
  format($$ select public.afgoer_anke(gen_random_uuid(), %L, 'modtager_vandt') $$, :'a3'),
  'P0001', 'allerede_annulleret', 'no verdict on an annulled Bøde');

select throws_ok(
  format($$ select public.afgoer_anke(gen_random_uuid(), %L, 'modtager_vandt') $$, gen_random_uuid()),
  'P0001', 'ikke_fundet', 'an unknown Anke is not found');

-- A won Anke moves the Bøde to the giver even when the giver is Udmeldt.
select tests.giv_bode(:'bo', :'carl', p_kategori => :'for_sent') as b4 \gset
select tests.log_ind_som_medlem(:'carl');
select public.indgiv_anke(gen_random_uuid(), :'b4') ->> 'anke_id' as a4 \gset
select tests.log_ind_som_medlem(:'anna');
select public.udmeld(gen_random_uuid(), :'kasse', :'bo');
select tests.log_ind_som_medlem(:'dan');
select public.afgoer_anke(gen_random_uuid(), :'a4', 'modtager_vandt');
select results_eq(
  format($$ select baerer_id, (select saldo from public.medlem_saldo where medlem_id = %L)
              from public.bode_baerer where id = %L $$, :'bo', :'b4'),
  format($$ values (%L::uuid, 100) $$, :'bo'),
  'the Bøde moves to an Udmeldt giver too (Saldo 50 + 50 kr)');

-- ---------- Changing the verdict ----------
select tests.log_ind_som_medlem(:'eva');
select throws_ok(
  format($$ select public.aendr_afgoerelse(gen_random_uuid(), %L, 'giver_vandt') $$, :'a1'),
  '42501', 'ikke_tilladt', 'only the recorder or an Admin can change a verdict');

select tests.log_ind_som_medlem(:'dan');
select throws_ok(
  format($$ select public.aendr_afgoerelse(gen_random_uuid(), %L, 'modtager_vandt') $$, :'a1'),
  'P0001', 'samme_afgoerelse', 'a change must pick the other verdict');

select saldo as carl_foer from public.medlem_saldo where medlem_id = :'carl' \gset
select public.aendr_afgoerelse(gen_random_uuid(), :'a1', 'giver_vandt');
select results_eq(
  format($$ select a.afgoerelse::text, a.aendret, b.baerer_id,
                   (select saldo from public.medlem_saldo where medlem_id = %L),
                   (select saldo from public.medlem_saldo where medlem_id = %L)
              from public.anke a join public.bode_baerer b on b.id = a.bode_id where a.id = %L $$,
         :'bo', :'carl', :'a1'),
  format($$ values ('giver_vandt', true, %L::uuid, 50, %s + 50) $$, :'carl', :'carl_foer'),
  'the recorder changes it: tagged changed, and the Bøde moves back to the receiver');

select results_eq(
  $$ select aktoer_id, data->>'afgoerelse', (data->>'aendret')::boolean
       from public.haendelse where art = 'anke_afgjort' order by id desc limit 1 $$,
  format($$ values (%L::uuid, 'giver_vandt', true) $$, :'dan'),
  'a change gets its own feed entry, marked as changed');

select tests.log_ind_som_medlem(:'anna');
select public.aendr_afgoerelse(gen_random_uuid(), :'a1', 'modtager_vandt');
select results_eq(
  format($$ select afgoerelse::text, afgjort_af from public.anke where id = %L $$, :'a1'),
  format($$ values ('modtager_vandt', %L::uuid) $$, :'anna'),
  'an Admin can change it too, and becomes the one who decided');

-- An open Anke has nothing to change yet.
select tests.giv_bode(:'dan', :'carl', p_kategori => :'for_sent') as b5 \gset
select tests.log_ind_som_medlem(:'carl');
select public.indgiv_anke(gen_random_uuid(), :'b5') ->> 'anke_id' as a5 \gset
select tests.log_ind_som_medlem(:'anna');
select throws_ok(
  format($$ select public.aendr_afgoerelse(gen_random_uuid(), %L, 'modtager_vandt') $$, :'a5'),
  'P0001', 'anke_ikke_afgjort', 'an open Anke has no verdict to change');

-- ---------- The Sæson rule ----------
-- In a Pause the latest Sæson's verdicts can still be recorded and changed.
select public.afslut_saeson(gen_random_uuid(), :'kasse');
select tests.log_ind_som_medlem(:'eva');
select lives_ok(
  format($$ select public.afgoer_anke(gen_random_uuid(), %L, 'giver_vandt') $$, :'a5'),
  'a verdict can be recorded in a Pause');

-- Once the next Sæson starts, they are locked.
select tests.log_ind_som_medlem(:'anna');
select public.start_saeson(gen_random_uuid(), :'kasse');
select throws_ok(
  format($$ select public.aendr_afgoerelse(gen_random_uuid(), %L, 'giver_vandt') $$, :'a1'),
  'P0001', 'tidligere_saeson', 'no change after the next Sæson starts');

select * from finish();
rollback;
