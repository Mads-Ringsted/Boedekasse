-- Konkurrencer (#66): any Medlem records one; placement and absent Gebyrer
-- appear at once. Recorder or Admin corrects (running Sæson) or annuls it.
begin;
\ir _hjaelpere.psql
select plan(32);

select tests.opret_bodekasse('Kasse A') as kasse \gset
select tests.opret_medlem_med_login(:'kasse', 'Mads', true) as mads \gset
select tests.opret_medlem_med_login(:'kasse', 'Frederik') as frederik \gset
select tests.opret_medlem_med_login(:'kasse', 'Kasper') as kasper \gset
select tests.opret_medlem_med_login(:'kasse', 'Jonas') as jonas \gset
select tests.opret_medlem_med_login(:'kasse', 'Emil') as emil \gset
select tests.opret_medlem(:'kasse', 'Sebastian', 'sebastian@test.dk') as sebastian \gset
select tests.opret_medlem_med_login(:'kasse', 'Oliver') as oliver \gset
update public.medlem set udmeldt = now() where id = :'oliver';

select tests.opret_bodekasse('Kasse B') as kasse_b \gset
select tests.opret_medlem_med_login(:'kasse_b', 'Bent') as bent \gset

-- ---------- Off by default ----------
select tests.log_ind_som_medlem(:'frederik');
select throws_ok(
  format($$ select public.registrer_konkurrence(gen_random_uuid(), %L, 'Bowling', null,
                     jsonb_build_array(jsonb_build_array(%L))) $$, :'kasse', :'frederik'),
  'P0001', 'konkurrence_slaaet_fra', 'with Konkurrence off (the default), recording is rejected');

-- ---------- Settings ----------
select tests.log_ind_som_medlem(:'mads');
select public.opdater_indstillinger(gen_random_uuid(), :'kasse',
  '{"konkurrence_til": true, "placeringer": [0, 10, 25, 35], "fravaersgebyr": 50}');
select results_eq(
  format($$ select konkurrence_til, placeringer, fravaersgebyr from public.bodekasse where id = %L $$, :'kasse'),
  $$ values (true, '{0,10,25,35}'::int[], 50) $$,
  'an Admin switches Konkurrence on and sets the placement table and absent Gebyr');
select throws_ok(
  format($$ select public.opdater_indstillinger(gen_random_uuid(), %L, '{"placeringer": []}') $$, :'kasse'),
  'P0001', 'indstilling_ugyldig', 'an empty placement table is rejected');
select throws_ok(
  format($$ select public.opdater_indstillinger(gen_random_uuid(), %L, '{"placeringer": [0, -5]}') $$, :'kasse'),
  'P0001', 'indstilling_ugyldig', 'a negative placement amount is rejected');
select throws_ok(
  format($$ select public.opdater_indstillinger(gen_random_uuid(), %L, '{"fravaersgebyr": 0}') $$, :'kasse'),
  'P0001', 'indstilling_ugyldig', 'an absent Gebyr of 0 is rejected');

-- ---------- Record: ties share a place and skip the next ----------
select tests.log_ind_som_medlem(:'frederik');
select gen_random_uuid() as id_bowling \gset
select (public.registrer_konkurrence(:'id_bowling', :'kasse', ' Bowling ', '2026-10-10',
          jsonb_build_array(jsonb_build_array(:'frederik'), jsonb_build_array(:'kasper', :'jonas'),
                            jsonb_build_array(:'emil')))
        ->> 'konkurrence_id') as bowling \gset

select results_eq(
  format($$ select medlem_navn, plads, beloeb from public.konkurrence_resultat_visning
             where konkurrence_id = %L order by plads nulls last, medlem_navn $$, :'bowling'),
  $$ values ('Frederik', 1, 0), ('Jonas', 2, 10), ('Kasper', 2, 10), ('Emil', 4, 35),
            ('Mads', null::int, 50), ('Sebastian', null::int, 50) $$,
  'ties share a place (1, 2, 2, 4); every other active Medlem (claimed or not, not Udmeldt) pays the absent Gebyr');

select results_eq(
  format($$ select titel, dato, oprettet_af_navn, antal_placeret, antal_fravaerende, antal_gebyrer, total
              from public.konkurrence_visning where id = %L $$, :'bowling'),
  $$ values ('Bowling', '2026-10-10'::date, 'Frederik', 4, 2, 6, 155) $$,
  'konkurrence_visning shows title, date, recorder, counts and total');

select is((select saldo from public.medlem_saldo where medlem_id = :'emil'), 35,
  'a placement Gebyr counts in the Saldo at once');
select is((select saldo from public.medlem_saldo where medlem_id = :'sebastian'), 50,
  'the absent Gebyr counts in the Saldo of a Medlem who has not logged in');

select results_eq(
  format($$ select art, aktoer_id, data, konkurrence ->> 'titel', jsonb_array_length(gebyrer),
                   involverede @> array[%L, %L]::uuid[]
              from public.aktivitet where ref_id = %L $$, :'emil', :'sebastian', :'bowling'),
  format($$ values ('konkurrence_registreret', %L::uuid, '{"titel": "Bowling"}'::jsonb, 'Bowling', 6, true) $$,
         :'frederik'),
  'one feed entry carries the Konkurrence and its Gebyrer, and shows in every payer''s history');

select public.registrer_konkurrence(:'id_bowling', :'kasse', 'Bowling', '2026-10-10',
         jsonb_build_array(jsonb_build_array(:'frederik')));
select is((select count(*) from public.konkurrence where bodekasse_id = :'kasse'), 1::bigint,
  'a repeated one-time ID records the Konkurrence only once');

-- Places past the table pay the last amount.
select (public.registrer_konkurrence(gen_random_uuid(), :'kasse', 'Darts', null,
          jsonb_build_array(jsonb_build_array(:'mads'), jsonb_build_array(:'frederik'),
                            jsonb_build_array(:'kasper'), jsonb_build_array(:'jonas'),
                            jsonb_build_array(:'emil'), jsonb_build_array(:'sebastian')))
        ->> 'konkurrence_id') as darts \gset
select results_eq(
  format($$ select plads, beloeb from public.konkurrence_resultat_visning
             where konkurrence_id = %L order by plads $$, :'darts'),
  $$ values (1, 0), (2, 10), (3, 25), (4, 35), (5, 35), (6, 35) $$,
  'places past the end of the table pay its last amount');
select is((select dato from public.konkurrence where id = :'darts'),
  (now() at time zone 'Europe/Copenhagen')::date, 'the date defaults to today');

-- ---------- Rejections ----------
select throws_ok(
  format($$ select public.registrer_konkurrence(gen_random_uuid(), %L, '  ', null,
                     jsonb_build_array(jsonb_build_array(%L))) $$, :'kasse', :'mads'),
  'P0001', 'titel_mangler', 'a title is required');
select throws_ok(
  format($$ select public.registrer_konkurrence(gen_random_uuid(), %L, 'X', null, '[]') $$, :'kasse'),
  'P0001', 'ingen_placeret', 'at least one Medlem must be placed');
select throws_ok(
  format($$ select public.registrer_konkurrence(gen_random_uuid(), %L, 'X', null,
                     jsonb_build_array(jsonb_build_array(%L), jsonb_build_array(%L))) $$, :'kasse', :'mads', :'mads'),
  'P0001', 'konkurrence_ugyldig', 'a Medlem cannot be placed twice');
select throws_ok(
  format($$ select public.registrer_konkurrence(gen_random_uuid(), %L, 'X', null,
                     jsonb_build_array(jsonb_build_array(%L))) $$, :'kasse', :'oliver'),
  'P0001', 'deltager_ukendt', 'an Udmeldt Medlem cannot be placed');
select throws_ok(
  format($$ select public.registrer_konkurrence(gen_random_uuid(), %L, 'X', null,
                     jsonb_build_array(jsonb_build_array(%L))) $$, :'kasse', :'bent'),
  'P0001', 'deltager_ukendt', 'another box''s Medlem cannot be placed');
select tests.log_ind_som_medlem(:'bent');
select throws_ok(
  format($$ select public.registrer_konkurrence(gen_random_uuid(), %L, 'X', null,
                     jsonb_build_array(jsonb_build_array(%L))) $$, :'kasse', :'bent'),
  '42501', 'ikke_medlem', 'a non-Medlem cannot record a Konkurrence in the box');

-- ---------- Correct ----------
select tests.log_ind_som_medlem(:'kasper');
select throws_ok(
  format($$ select public.ret_konkurrence(gen_random_uuid(), %L, 'Bowling', null,
                     jsonb_build_array(jsonb_build_array(%L))) $$, :'bowling', :'kasper'),
  '42501', 'ikke_tilladt', 'only the recorder or an Admin can correct a Konkurrence');

select tests.log_ind_som_medlem(:'mads');
select public.ret_konkurrence(gen_random_uuid(), :'bowling', 'Bowling', '2026-10-10',
         jsonb_build_array(jsonb_build_array(:'emil'), jsonb_build_array(:'frederik')));
select results_eq(
  format($$ select medlem_navn, plads, beloeb from public.konkurrence_resultat_visning
             where konkurrence_id = %L order by plads nulls last, medlem_navn $$, :'bowling'),
  $$ values ('Emil', 1, 0), ('Frederik', 2, 10), ('Jonas', null::int, 50), ('Kasper', null::int, 50),
            ('Mads', null::int, 50), ('Sebastian', null::int, 50) $$,
  'a correction replaces the result');
select results_eq(
  format($$ select m.navn, r.plads, r.annulleret_af, r.annulleret_note
              from public.konkurrence_resultat r join public.medlem m on m.id = r.medlem_id
             where r.konkurrence_id = %L and r.annulleret is not null
             order by r.plads nulls last, m.navn $$, :'bowling'),
  format($$ values ('Frederik', 1, %1$L::uuid, 'rettet'), ('Jonas', 2, %1$L::uuid, 'rettet'),
                   ('Kasper', 2, %1$L::uuid, 'rettet'), ('Emil', 4, %1$L::uuid, 'rettet'),
                   ('Mads', null::int, %1$L::uuid, 'rettet'), ('Sebastian', null::int, %1$L::uuid, 'rettet') $$,
         :'mads'),
  'a correction keeps the old placements, annulled with the note "rettet" (nothing is deleted)');
select results_eq(
  format($$ select count(*) filter (where annulleret is not null and annulleret_note = 'rettet' and annulleret_af = %L),
                   count(*) filter (where annulleret is null)
              from public.gebyr where konkurrence_id = %L $$, :'mads', :'bowling'),
  $$ values (6::bigint, 6::bigint) $$,
  'a correction annuls the old Gebyrer (note "rettet") and charges new ones');
select is((select saldo from public.medlem_saldo where medlem_id = :'emil'), 35,
  'after the correction Emil pays only the new Gebyr (0 kr here, 35 kr from Darts)');
select is((select konkurrence ->> 'rettet_af_navn' from public.aktivitet where ref_id = :'bowling'), 'Mads',
  'the feed entry shows who corrected it');

-- ---------- Annul ----------
select tests.log_ind_som_medlem(:'frederik');
select public.annuller_konkurrence(gen_random_uuid(), :'bowling', 'Forkert dag');
select results_eq(
  format($$ select count(*) filter (where annulleret is null), count(*) filter (where annulleret_note = 'Forkert dag')
              from public.gebyr where konkurrence_id = %L $$, :'bowling'),
  $$ values (0::bigint, 6::bigint) $$,
  'annulling the Konkurrence annuls all its Gebyrer');
select results_eq(
  format($$ select annulleret is not null, annulleret_af_navn, annulleret_note from public.aktivitet
             where ref_id = %L $$, :'bowling'),
  $$ values (true, 'Frederik', 'Forkert dag') $$,
  'the original feed entry shows struck through');
select results_eq(
  format($$ select art, data ->> 'titel', (data ->> 'beloeb')::int, annulleret from public.aktivitet
             where bodekasse_id = %L order by id desc limit 1 $$, :'kasse'),
  $$ values ('konkurrence_annulleret', 'Bowling', 210, null::timestamptz) $$,
  'a new "annullerede" entry appears at the top, not struck itself');
select throws_ok(
  format($$ select public.annuller_konkurrence(gen_random_uuid(), %L) $$, :'bowling'),
  'P0001', 'allerede_annulleret', 'an annulled Konkurrence cannot be annulled again');

-- ---------- Pause ----------
select tests.log_ud();
update public.saeson set afsluttet = now() where bodekasse_id = :'kasse';
select tests.log_ind_som_medlem(:'mads');
select throws_ok(
  format($$ select public.registrer_konkurrence(gen_random_uuid(), %L, 'X', null,
                     jsonb_build_array(jsonb_build_array(%L))) $$, :'kasse', :'mads'),
  'P0001', 'pause', 'recording a Konkurrence in a Pause is rejected');
select throws_ok(
  format($$ select public.ret_konkurrence(gen_random_uuid(), %L, 'Darts', null,
                     jsonb_build_array(jsonb_build_array(%L))) $$, :'darts', :'mads'),
  'P0001', 'pause', 'correcting a Konkurrence in a Pause is rejected');
select lives_ok(
  format($$ select public.annuller_konkurrence(gen_random_uuid(), %L) $$, :'darts'),
  'annulling works in a Pause (the latest Sæson)');

select * from finish();
rollback;
