-- Frikøb per Bødekategori: a Medlem buys out one Bødekategori for the rest
-- of the Sæson. It charges a Frikøbsgebyr at the price of the moment and
-- only blocks giving that Bødekategori to that Medlem.
begin;
\ir _hjaelpere.psql
select plan(40);

select tests.opret_bodekasse('Kasse A') as kasse \gset
select tests.opret_medlem_med_login(:'kasse', 'Mads Ringsted', true) as mads \gset
select tests.opret_medlem_med_login(:'kasse', 'Oliver Krogh') as oliver \gset
select tests.opret_medlem_med_login(:'kasse', 'Jonas Holm') as jonas \gset
select tests.opret_medlem_med_login(:'kasse', 'Emil Bach') as emil \gset
select tests.opret_medlem(:'kasse', 'Ulla Udmeldt') as ulla \gset
update public.medlem set udmeldt = now() where id = :'ulla';
select tests.opret_bodekategori(:'mads', 'For sent', 50) as for_sent \gset
select tests.opret_bodekategori(:'mads', 'Bandeord', 10) as bandeord \gset
select tests.opret_bodekategori(:'mads', 'Spildt drikke', 20) as spildt \gset

select tests.opret_bodekasse('Kasse B') as kasse_b \gset
select tests.opret_medlem_med_login(:'kasse_b', 'Bo Anden') as bo \gset
select tests.opret_bodekategori(:'bo', 'Anden kasses', 10) as anden_kategori \gset

create function tests.linje(p_modtager uuid, p_kategori uuid, p_antal int default 1)
returns jsonb language sql as $$
  select jsonb_build_object('modtager_id', p_modtager, 'bodekategori_id', p_kategori, 'antal', p_antal)
$$;
grant execute on function tests.linje(uuid, uuid, int) to authenticated;

-- ---------- The setting ----------
select tests.log_ind_som_medlem(:'oliver');
select throws_ok(
  format($$ select public.koeb_frikob(gen_random_uuid(), %L, %L) $$, :'kasse', :'for_sent'),
  'P0001', 'frikob_slaaet_fra', 'Frikøb is off by default: nobody can buy one');

select tests.log_ind_som_medlem(:'mads');
select public.opdater_indstillinger(gen_random_uuid(), :'kasse', '{"frikob_til": true, "frikob_pris": 300}');
select results_eq(
  format($$ select frikob_til, frikob_pris from public.bodekasse where id = %L $$, :'kasse'),
  $$ values (true, 300) $$,
  'an Admin turns Frikøb on and sets its price in Indstillinger');

-- ---------- Buying ----------
select tests.log_ind_som_medlem(:'oliver');
select gen_random_uuid() as koeb_id \gset
select public.koeb_frikob(:'koeb_id', :'kasse', :'for_sent') as svar \gset
select is(:'svar'::jsonb - 'frikob_id', '{"beloeb": 300}'::jsonb,
  'buying a Frikøb answers with the price paid');
select (:'svar'::jsonb ->> 'frikob_id')::uuid as frikob \gset

select is((select saldo from public.medlem_saldo where medlem_id = :'oliver'), 300,
  'the Frikøbsgebyr counts in the buyer''s Saldo at once');
select is(
  (select t.boeder_i_alt from public.medlem_saeson_tal t join public.bodekasse_saeson s
       on s.seneste_saeson_id = t.saeson_id
    where t.medlem_id = :'oliver'),
  300, 'the Frikøbsgebyr counts in Bøder i alt');

select results_eq(
  format($$ select id, medlem_navn, bodekategori_id, bodekategori_navn, pris
              from public.frikob_aktiv where bodekasse_id = %L $$, :'kasse'),
  format($$ values (%L::uuid, 'Oliver Krogh', %L::uuid, 'For sent', 300) $$, :'frikob', :'for_sent'),
  'frikob_aktiv lists the Frikøb with its holder, Bødekategori and price');

select results_eq(
  format($$ select art, aktoer_id, modtager_id, data, jsonb_array_length(gebyrer),
                   gebyrer -> 0 ->> 'art', (gebyrer -> 0 ->> 'beloeb')::int, annulleret is null
              from public.aktivitet where ref_tabel = 'frikob' and ref_id = %L $$, :'frikob'),
  format($$ values ('frikob_koebt', %1$L::uuid, %1$L::uuid, '{"navn": "For sent", "beloeb": 300}'::jsonb,
                    1, 'frikob', 300, true) $$, :'oliver'),
  'the feed shows "Oliver købte Frikøb · For sent · 300 kr" with its Gebyr');

select is(public.koeb_frikob(:'koeb_id', :'kasse', :'for_sent'), :'svar'::jsonb,
  'repeating the same one-time ID returns the first answer');
select is((select count(*)::int from public.frikob_aktiv where medlem_id = :'oliver'), 1,
  'repeating the same one-time ID buys nothing new');

select throws_ok(
  format($$ select public.koeb_frikob(gen_random_uuid(), %L, %L) $$, :'kasse', :'for_sent'),
  'P0001', 'frikob_findes', 'one Frikøb per Bødekategori per Medlem per Sæson');

-- The price is locked when bought.
select tests.log_ind_som_medlem(:'mads');
select public.opdater_indstillinger(gen_random_uuid(), :'kasse', '{"frikob_pris": 400}');
select tests.log_ind_som_medlem(:'oliver');
select is((select saldo from public.medlem_saldo where medlem_id = :'oliver'), 300,
  'a new Frikøb price never changes a Frikøb already bought');
select is(public.koeb_frikob(gen_random_uuid(), :'kasse', :'bandeord') ->> 'beloeb', '400',
  'a Medlem can hold Frikøb on several Bødekategorier, each at the price of the moment');

-- ---------- Giving ----------
select tests.log_ind_som_medlem(:'jonas');
select throws_ok(
  format($$ select public.giv_boeder(gen_random_uuid(), %L, jsonb_build_array(tests.linje(%L, %L))) $$,
         :'kasse', :'oliver', :'for_sent'),
  'P0001', 'har_frikob', 'nobody can give a Medlem a Bødekategori they have bought out');

select throws_ok(
  format($$ select public.giv_boeder(gen_random_uuid(), %L, jsonb_build_array(
              tests.linje(%L, %L), tests.linje(%L, %L))) $$,
         :'kasse', :'emil', :'for_sent', :'oliver', :'for_sent'),
  'P0001', 'har_frikob', 'a submit with one bought-out line is rejected as a whole');
select is((select count(*)::int from public.bode where modtager_id = :'emil'), 0,
  'a rejected submit gives nobody anything');

select public.giv_boeder(gen_random_uuid(), :'kasse', jsonb_build_array(
  tests.linje(:'emil', :'for_sent'), tests.linje(:'oliver', :'spildt')));
select is((select saldo from public.medlem_saldo where medlem_id = :'oliver'), 720,
  'a Frikøb holder still gets other Bødekategorier, and others still get the bought-out one');

-- An Engangsbøde is never covered.
select public.giv_boeder(gen_random_uuid(), :'kasse', jsonb_build_array(
  jsonb_build_object('modtager_id', :'oliver', 'grund', 'For sent igen', 'beloeb', 15)));
select is((select saldo from public.medlem_saldo where medlem_id = :'oliver'), 735,
  'an Engangsbøde still lands on a Frikøb holder');

-- A Bøde moved by a won Anke is never covered.
select tests.giv_bode(:'oliver', :'jonas', p_kategori => :'for_sent') as bode_til_jonas \gset
select tests.anke(:'bode_til_jonas', 'modtager_vandt');
select is((select baerer_id from public.bode_baerer where id = :'bode_til_jonas'), :'oliver'::uuid,
  'a won Anke moves a bought-out Bødekategori''s Bøde onto the Frikøb holder');
select is((select saldo from public.medlem_saldo where medlem_id = :'oliver'), 785,
  'the moved Bøde counts in the Frikøb holder''s Saldo');

-- Archiving or bringing back the Bødekategori doesn't change the Frikøb.
select tests.log_ind_som_medlem(:'mads');
select public.arkiver_bodekategori(gen_random_uuid(), :'for_sent');
select is((select bodekategori_navn from public.frikob_aktiv where id = :'frikob'), 'For sent',
  'an archived Bødekategori keeps its Frikøb');
select public.gendan_bodekategori(gen_random_uuid(), :'for_sent');
select tests.log_ind_som_medlem(:'jonas');
select throws_ok(
  format($$ select public.giv_boeder(gen_random_uuid(), %L, jsonb_build_array(tests.linje(%L, %L))) $$,
         :'kasse', :'oliver', :'for_sent'),
  'P0001', 'har_frikob', 'a Bødekategori brought back from the archive is still bought out');

-- ---------- Rules for buying ----------
select tests.log_ind_som_medlem(:'mads');
select public.arkiver_bodekategori(gen_random_uuid(), :'spildt');
select tests.log_ind_som_medlem(:'jonas');
select throws_ok(
  format($$ select public.koeb_frikob(gen_random_uuid(), %L, %L) $$, :'kasse', :'spildt'),
  'P0001', 'arkiveret', 'an archived Bødekategori can''t be bought out');
select throws_ok(
  format($$ select public.koeb_frikob(gen_random_uuid(), %L, %L) $$, :'kasse', :'anden_kategori'),
  'P0001', 'ikke_fundet', 'another box''s Bødekategori can''t be bought out');
select throws_ok(
  format($$ select public.koeb_frikob(gen_random_uuid(), %L, %L, %L) $$, :'kasse', :'for_sent', :'emil'),
  '42501', 'ikke_admin', 'only an Admin registers a Frikøb for someone else');

-- An Admin registers one for a Medlem.
select tests.log_ind_som_medlem(:'mads');
select (public.koeb_frikob(gen_random_uuid(), :'kasse', :'for_sent', :'jonas') ->> 'frikob_id')::uuid
  as frikob_jonas \gset
select results_eq(
  format($$ select medlem_id, registreret_af from public.frikob_aktiv where id = %L $$, :'frikob_jonas'),
  format($$ values (%L::uuid, %L::uuid) $$, :'jonas', :'mads'),
  'an Admin registers a Frikøb for a Medlem: it covers them and records who registered it');
select is((select saldo from public.medlem_saldo where medlem_id = :'jonas'), 410,
  'the Medlem pays the Frikøbsgebyr an Admin registered (on top of the 10 kr Engangsbøde Gebyr)');
select results_eq(
  format($$ select aktoer_id, modtager_id from public.aktivitet where ref_id = %L $$, :'frikob_jonas'),
  format($$ values (%L::uuid, %L::uuid) $$, :'mads', :'jonas'),
  'the feed entry names the Admin and the Medlem it covers');
select throws_ok(
  format($$ select public.koeb_frikob(gen_random_uuid(), %L, %L, %L) $$, :'kasse', :'for_sent', :'ulla'),
  'P0001', 'modtager_udmeldt', 'an Udmeldt Medlem can''t get a Frikøb');

-- Off only stops new purchases.
select public.opdater_indstillinger(gen_random_uuid(), :'kasse', '{"frikob_til": false}');
select throws_ok(
  format($$ select public.koeb_frikob(gen_random_uuid(), %L, %L, %L) $$, :'kasse', :'bandeord', :'emil'),
  'P0001', 'frikob_slaaet_fra', 'with Frikøb off, nobody can buy a new one');
select tests.log_ind_som_medlem(:'emil');
select throws_ok(
  format($$ select public.giv_boeder(gen_random_uuid(), %L, jsonb_build_array(tests.linje(%L, %L))) $$,
         :'kasse', :'oliver', :'for_sent'),
  'P0001', 'har_frikob', 'turning Frikøb off keeps the Frikøb already bought');

select tests.log_ind_som_medlem(:'mads');
select public.opdater_indstillinger(gen_random_uuid(), :'kasse', '{"frikob_til": true}');
select tests.log_ud();
update public.saeson set afsluttet = now() where bodekasse_id = :'kasse';
select tests.log_ind_som_medlem(:'mads');
select throws_ok(
  format($$ select public.koeb_frikob(gen_random_uuid(), %L, %L) $$, :'kasse', :'bandeord'),
  'P0001', 'pause', 'a Frikøb needs a running Sæson');
select tests.log_ud();
update public.saeson set afsluttet = null where bodekasse_id = :'kasse';

-- ---------- Annulling ----------
select tests.log_ind_som_medlem(:'oliver');
select throws_ok(
  format($$ select public.annuller_frikob(gen_random_uuid(), %L) $$, :'frikob'),
  '42501', 'ikke_admin', 'only an Admin annuls a Frikøb');

select tests.log_ind_som_medlem(:'mads');
select public.annuller_frikob(gen_random_uuid(), :'frikob', ' Fejlkøb ');
select is((select count(*)::int from public.frikob_aktiv where id = :'frikob'), 0,
  'an annulled Frikøb no longer covers anyone');
select is((select saldo from public.medlem_saldo where medlem_id = :'oliver'), 485,
  'annulling a Frikøb annuls its Frikøbsgebyr');
select results_eq(
  format($$ select annulleret is not null, annulleret_af_navn, annulleret_note,
                   gebyrer -> 0 ->> 'annulleret' is not null
              from public.aktivitet where ref_id = %L $$, :'frikob'),
  $$ values (true, 'Mads Ringsted', 'Fejlkøb', true) $$,
  'the bought entry stays in the feed, struck through with its Gebyr');
select results_eq(
  format($$ select aktoer_id, modtager_id, data ->> 'navn', (data ->> 'beloeb')::int, ref_id
              from public.aktivitet where art = 'frikob_annulleret' and data ->> 'frikob_id' = %L $$, :'frikob'),
  format($$ values (%L::uuid, %L::uuid, 'For sent', 300, null::uuid) $$, :'mads', :'oliver'),
  'a new feed entry says the Admin annulled it');
select throws_ok(
  format($$ select public.annuller_frikob(gen_random_uuid(), %L) $$, :'frikob'),
  'P0001', 'allerede_annulleret', 'a Frikøb can''t be annulled twice');

select tests.log_ind_som_medlem(:'jonas');
select lives_ok(
  format($$ select public.giv_boeder(gen_random_uuid(), %L, jsonb_build_array(tests.linje(%L, %L))) $$,
         :'kasse', :'oliver', :'for_sent'),
  'after the annulment the Bødekategori can be given again');

-- ---------- A new Sæson ----------
select tests.log_ud();
update public.saeson set afsluttet = now() where bodekasse_id = :'kasse';
insert into public.saeson (bodekasse_id, navn) values (:'kasse', 'Sæson 2');
select tests.log_ind_som_medlem(:'mads');
select is((select count(*)::int from public.frikob_aktiv where bodekasse_id = :'kasse'), 0,
  'a Frikøb lasts for the rest of its Sæson only');
select throws_ok(
  format($$ select public.annuller_frikob(gen_random_uuid(), %L) $$, :'frikob_jonas'),
  'P0001', 'tidligere_saeson', 'a past Sæson''s Frikøb can''t be annulled');

select * from finish();
rollback;
