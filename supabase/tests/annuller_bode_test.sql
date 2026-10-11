-- Annulling a Bøde (#62): the giver annuls their own un-appealed Bøde, an
-- Admin any Bøde. Optional note, once, never reversed. Allowed in the latest
-- Sæson until the next one starts (Pause included), never in a past Sæson.
-- The Bøde stays (struck through) but leaves every sum.
begin;
\ir _hjaelpere.psql
select plan(14);

select tests.opret_bodekasse() as kasse \gset
select tests.opret_medlem_med_login(:'kasse', 'Anna', true) as anna \gset
select tests.opret_medlem_med_login(:'kasse', 'Bo') as bo \gset
select tests.opret_medlem_med_login(:'kasse', 'Carl') as carl \gset
select tests.opret_bodekategori(:'anna', 'For sent', 50) as for_sent \gset

-- Bo gave Carl a Bøde and annuls it himself.
select tests.giv_bode(:'bo', :'carl', p_kategori => :'for_sent') as b1 \gset
select tests.log_ind_som_medlem(:'bo');
select public.annuller_bode(gen_random_uuid(), :'b1', ' Forkert person ');
select results_eq(
  format($$ select (select saldo from public.medlem_saldo where medlem_id = %L),
                   (select annulleret_af from public.bode where id = %L),
                   (select annulleret_note from public.bode where id = %L) $$, :'carl', :'b1', :'b1'),
  format($$ values (0, %L::uuid, 'Forkert person') $$, :'bo'),
  'the giver annuls their own Bøde: it stays, marked with who and the note, and leaves Saldo');

select results_eq(
  format($$ select (select boeder_i_alt from public.medlem_saeson_tal where medlem_id = %L),
                   (select antal from public.bodekategori_brug where bodekategori_id = %L),
                   (select boeder_i_alt from public.topliste where medlem_id = %L) $$,
         :'carl', :'for_sent', :'carl'),
  $$ values (0, 0, 0) $$,
  'an annulled Bøde leaves Bøder i alt, the use count and the Topliste');

select results_eq(
  $$ select art, aktoer_id, modtager_id, ref_tabel, ref_id, data->>'bode_id', data->>'giver_id',
            data->>'giver_navn', data->>'navn', (data->>'pris')::int, data->>'note'
       from public.haendelse where art = 'bode_annulleret' $$,
  format($$ values ('bode_annulleret', %L::uuid, %L::uuid, null::text, null::uuid, %L, %L,
                    'Bo', 'For sent', 50, 'Forkert person') $$, :'bo', :'carl', :'b1', :'bo'),
  'the annulment adds its own feed row about the Bøde, without pointing at it as its subject');

select throws_ok(
  format($$ select public.annuller_bode(gen_random_uuid(), %L) $$, :'b1'),
  'P0001', 'allerede_annulleret', 'a Bøde cannot be annulled twice');

-- A retry with the same one-time ID returns the first answer.
select tests.giv_bode(:'bo', :'carl', p_kategori => :'for_sent') as b2 \gset
select tests.log_ind_som_medlem(:'bo');
select gen_random_uuid() as gentag \gset
select public.annuller_bode(:'gentag', :'b2') as svar1 \gset
select is(public.annuller_bode(:'gentag', :'b2'), :'svar1'::jsonb,
  'a repeat with the same one-time ID returns the first answer instead of failing');

-- Permissions.
select tests.giv_bode(:'bo', :'carl', p_kategori => :'for_sent') as b3 \gset
select tests.log_ind_som_medlem(:'carl');
select throws_ok(
  format($$ select public.annuller_bode(gen_random_uuid(), %L) $$, :'b3'),
  '42501', 'ikke_tilladt', 'the receiver cannot annul a Bøde they got');

select tests.anke(:'b3') as anke3 \gset
select tests.log_ind_som_medlem(:'bo');
select throws_ok(
  format($$ select public.annuller_bode(gen_random_uuid(), %L) $$, :'b3'),
  'P0001', 'anket', 'the giver cannot annul a Bøde once it is appealed');

select tests.giv_bode(:'bo', :'carl', p_kategori => :'for_sent') as b4 \gset
select tests.anke(:'b4', 'giver_vandt');
select tests.log_ind_som_medlem(:'bo');
select throws_ok(
  format($$ select public.annuller_bode(gen_random_uuid(), %L) $$, :'b4'),
  'P0001', 'anket', 'the giver cannot annul a Bøde whose Anke is decided either');

-- An Admin annuls any Bøde, appealed or not. An open Anke stops counting as
-- pending, and nobody bears the Bøde.
select tests.log_ind_som_medlem(:'anna');
select public.annuller_bode(gen_random_uuid(), :'b3');
select public.annuller_bode(gen_random_uuid(), :'b4');
select results_eq(
  format($$ select id, anket, baerer_id from public.bode_baerer where id in (%L, %L) order by givet, id $$, :'b3', :'b4'),
  format($$ select * from (values (%L::uuid, false, null::uuid), (%L::uuid, false, null::uuid)) v order by 1 $$, :'b3', :'b4'),
  'an Admin annuls appealed Bøder; an annulled Bøde is neither anket nor borne by anyone');

-- Annulling an Engangsbøde annuls its Gebyr too (same who and note).
select tests.log_ud();
select tests.giv_bode(:'bo', :'carl', 100) as e1 \gset
insert into public.gebyr (bodekasse_id, saeson_id, medlem_id, art, beloeb, bode_id)
values (:'kasse', private.seneste_saeson(:'kasse'), :'bo', 'engangsbode', 10, :'e1');
select tests.log_ind_som_medlem(:'bo');
select public.annuller_bode(gen_random_uuid(), :'e1', 'Fejl');
select results_eq(
  format($$ select annulleret_af, annulleret_note, (select saldo from public.medlem_saldo where medlem_id = %L)
              from public.gebyr where bode_id = %L $$, :'bo', :'e1'),
  format($$ values (%L::uuid, 'Fejl', 0) $$, :'bo'),
  'annulling an Engangsbøde annuls its Gebyr too, so the giver stops paying it');

-- An Anke Gebyr always stays.
select tests.log_ud();
insert into public.gebyr (bodekasse_id, saeson_id, medlem_id, art, beloeb, anke_id)
values (:'kasse', private.seneste_saeson(:'kasse'), :'carl', 'anke', 37, :'anke3');
select tests.giv_bode(:'bo', :'carl', p_kategori => :'for_sent') as b5 \gset
select tests.anke(:'b5') as anke5 \gset
insert into public.gebyr (bodekasse_id, saeson_id, medlem_id, art, beloeb, anke_id)
values (:'kasse', private.seneste_saeson(:'kasse'), :'carl', 'anke', 12, :'anke5');
select tests.log_ind_som_medlem(:'anna');
select public.annuller_bode(gen_random_uuid(), :'b5');
select results_eq(
  format($$ select annulleret is null from public.gebyr where anke_id = %L $$, :'anke5'),
  $$ values (true) $$,
  'annulling an appealed Bøde leaves its Anke Gebyr standing');

-- Other boxes are out of reach.
select tests.opret_bodekasse('Anden') as kasse2 \gset
select tests.opret_medlem_med_login(:'kasse2', 'Dina', true) as dina \gset
select tests.giv_bode(:'bo', :'carl', p_kategori => :'for_sent') as b6 \gset
select tests.log_ind_som_medlem(:'dina');
select throws_ok(
  format($$ select public.annuller_bode(gen_random_uuid(), %L) $$, :'b6'),
  '42501', 'ikke_medlem', 'an Admin of another box cannot annul the Bøde');

-- In a Pause the ended Sæson is still the latest, so annulling works.
select tests.log_ud();
select private.seneste_saeson(:'kasse') as s1 \gset
update public.saeson set afsluttet = now() where id = :'s1';
select tests.log_ind_som_medlem(:'bo');
select public.annuller_bode(gen_random_uuid(), :'b6');
select results_eq(
  format($$ select annulleret is not null from public.bode where id = %L $$, :'b6'),
  $$ values (true) $$,
  'the giver can annul a Bøde in a Pause');

-- Once the next Sæson starts, the old one is read-only.
select tests.giv_bode(:'bo', :'carl', p_kategori => :'for_sent') as b7 \gset
select tests.log_ud();
insert into public.saeson (bodekasse_id, navn) values (:'kasse', 'Sæson 2');
select tests.log_ind_som_medlem(:'anna');
select throws_ok(
  format($$ select public.annuller_bode(gen_random_uuid(), %L) $$, :'b7'),
  'P0001', 'tidligere_saeson', 'a Bøde from a past Sæson cannot be annulled');

select * from finish();
rollback;
