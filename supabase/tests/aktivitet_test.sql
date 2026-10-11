-- Aktivitet: every feed entry of the box, newest first, with the live state
-- the app shows on each row (names, a batch's Bøder, Gebyrer, annulled).
begin;
\ir _hjaelpere.psql
select plan(10);

select tests.opret_bodekasse('Kasse A') as kasse \gset
select tests.opret_medlem_med_login(:'kasse', 'Jonas Holm') as jonas \gset
select tests.opret_medlem_med_login(:'kasse', 'Emil Bach') as emil \gset
select tests.opret_medlem_med_login(:'kasse', 'Kasper Nørgaard', true) as kasper \gset
select tests.opret_bodekategori(:'jonas', 'For sent', 50) as for_sent \gset
select tests.opret_bodekategori(:'jonas', 'Spildt drikke', 20) as spildt \gset

-- ---------- A Giv batch: one row per receiver, with its Bøder ----------
select tests.log_ind_som_medlem(:'jonas');
select public.giv_boeder(gen_random_uuid(), :'kasse', jsonb_build_array(
  jsonb_build_object('modtager_id', :'emil', 'bodekategori_id', :'for_sent', 'antal', 2),
  jsonb_build_object('modtager_id', :'emil', 'bodekategori_id', :'spildt', 'antal', 1),
  jsonb_build_object('modtager_id', :'kasper', 'bodekategori_id', :'for_sent', 'antal', 1)))
  ->> 'batch_id' as batch \gset

select tests.log_ind_som_medlem(:'kasper');
select results_eq(
  format($$ select art, aktoer_navn, modtager_navn,
                   (select jsonb_agg(jsonb_build_array(b ->> 'navn', (b ->> 'pris')::int, b ->> 'giver_navn')
                                     order by b ->> 'navn')
                      from jsonb_array_elements(boeder) b)
              from public.aktivitet where batch_id = %L order by modtager_navn $$, :'batch'),
  $$ values
    ('boeder_givet', 'Jonas Holm', 'Emil Bach',
     '[["For sent", 50, "Jonas Holm"], ["For sent", 50, "Jonas Holm"], ["Spildt drikke", 20, "Jonas Holm"]]'::jsonb),
    ('boeder_givet', 'Jonas Holm', 'Kasper Nørgaard', '[["For sent", 50, "Jonas Holm"]]'::jsonb) $$,
  'a Giv batch is one row per receiver, holding that receiver''s Bøder with names');

-- ---------- Each Bøde's live state ----------
select tests.log_ud();
select id as anket_bode from public.bode where batch_id = :'batch' and modtager_id = :'kasper' \gset
select tests.anke(:'anket_bode');
select id as annulleret_bode from public.bode
 where batch_id = :'batch' and modtager_id = :'emil' and pris = 20 \gset
update public.bode set annulleret = now(), annulleret_af = :'kasper', annulleret_note = 'Det var vand'
 where id = :'annulleret_bode';

select tests.log_ind_som_medlem(:'emil');
select results_eq(
  format($$ select anket, afgoerelse::text, annulleret is not null, annulleret_af_navn, annulleret_note, baerer_id
              from public.aktivitet_bode where id in (%L, %L) order by anket $$, :'annulleret_bode', :'anket_bode'),
  $$ values (false, null::text, true, 'Kasper Nørgaard', 'Det var vand', null::uuid),
            (true, null::text, false, null, null, null::uuid) $$,
  'a Bøde shows when it is anket, and who annulled it with their note');

select tests.log_ud();
update public.anke set afgoerelse = 'modtager_vandt', afgjort = now(), aendret = true
 where bode_id = :'anket_bode';
select tests.log_ind_som_medlem(:'emil');
select results_eq(
  format($$ select anket, afgoerelse::text, afgoerelse_aendret, baerer_id from public.aktivitet_bode where id = %L $$,
         :'anket_bode'),
  format($$ values (false, 'modtager_vandt', true, %L::uuid) $$, :'jonas'),
  'a Bøde shows its Anke verdict, whether it was changed, and who bears it now');

-- An Engangsbøde: the reason is its name, and the giver's Gebyr rides along.
select tests.log_ud();
select tests.giv_bode(:'jonas', :'emil', 100) as engangs \gset
insert into public.gebyr (bodekasse_id, saeson_id, medlem_id, art, beloeb, bode_id)
select bodekasse_id, saeson_id, giver_id, 'engangsbode', 10, id from public.bode where id = :'engangs';
select tests.log_ind_som_medlem(:'emil');
select results_eq(
  format($$ select navn, engangsbode, pris, gebyr from public.aktivitet_bode where id = %L $$, :'engangs'),
  $$ values ('Test', true, 100, 10) $$,
  'an Engangsbøde shows its reason as the name, and its Gebyr');

-- ---------- An annulled thing stays in the feed, marked ----------
select tests.log_ind_som_medlem(:'kasper');
select public.registrer_indbetaling(gen_random_uuid(), :'kasse', :'kasper', 300);
select public.haev(gen_random_uuid(), :'kasse', 300, 'Julefrokost') ->> 'haevning_id' as haevning \gset
select id as haevet_id from public.aktivitet where ref_id = :'haevning' \gset
select public.annuller_haevning(gen_random_uuid(), :'haevning', 'Forkert beløb');

select tests.log_ind_som_medlem(:'emil');
select results_eq(
  format($$ select annulleret is not null, annulleret_af_navn, annulleret_note from public.aktivitet where id = %s $$,
         :'haevet_id'),
  $$ values (true, 'Kasper Nørgaard', 'Forkert beløb') $$,
  'an entry about an annulled row says who annulled it and the note');
select results_eq(
  format($$ select annulleret, annulleret_af_navn from public.aktivitet where batch_id = %L $$, :'batch'),
  $$ values (null::timestamptz, null::text), (null, null) $$,
  'a Giv batch row is never marked annulled as a whole (its Bøder carry that)');

-- ---------- A Gebyr sits on the row of its cause ----------
select tests.log_ind_som_medlem(:'kasper');
select public.opret_bodekategori(gen_random_uuid(), :'kasse', 'Bandeord', 10) ->> 'bodekategori_id' as bandeord \gset
select public.ret_bodekategori(gen_random_uuid(), :'bandeord', 'Bandeord', 15, null);
select tests.log_ud();
insert into public.gebyr (bodekasse_id, saeson_id, medlem_id, art, beloeb, bodekategori_id)
values (:'kasse', (select seneste_saeson_id from public.bodekasse_saeson where bodekasse_id = :'kasse'), :'kasper', 'oprettelse', 25, :'bandeord');

select tests.log_ind_som_medlem(:'emil');
select results_eq(
  format($$ select art, (select jsonb_agg(jsonb_build_array(g ->> 'art', (g ->> 'beloeb')::int, g ->> 'medlem_navn',
                                                           g ->> 'annulleret'))
                           from jsonb_array_elements(gebyrer) g)
              from public.aktivitet where ref_id = %L order by id $$, :'bandeord'),
  $$ values ('bodekategori_oprettet', '[["oprettelse", 25, "Kasper Nørgaard", null]]'::jsonb),
            ('bodekategori_ompriset', null) $$,
  'a creation Gebyr sits on its Bødekategori''s created row only');

-- A Konkurrence row holds every Gebyr it charged, annulled ones marked.
select tests.log_ud();
insert into public.konkurrence (bodekasse_id, saeson_id, titel, oprettet_af)
values (:'kasse', (select seneste_saeson_id from public.bodekasse_saeson where bodekasse_id = :'kasse'), 'Bowling', :'jonas') returning id as bowling \gset
select private.tilfoej_haendelse(:'kasse', :'jonas', 'konkurrence', '{}',
                                 p_ref_tabel => 'konkurrence', p_ref_id => :'bowling') as bowling_id \gset
insert into public.gebyr (bodekasse_id, saeson_id, medlem_id, art, beloeb, konkurrence_id, annulleret, annulleret_af)
values (:'kasse', (select seneste_saeson_id from public.bodekasse_saeson where bodekasse_id = :'kasse'), :'emil', 'fravaer', 40, :'bowling', null, null),
       (:'kasse', (select seneste_saeson_id from public.bodekasse_saeson where bodekasse_id = :'kasse'), :'kasper', 'placering', 20, :'bowling', now(), :'jonas');

select tests.log_ind_som_medlem(:'emil');
select results_eq(
  format($$ select (g ->> 'beloeb')::int, g ->> 'annulleret_af_navn'
              from public.aktivitet, jsonb_array_elements(gebyrer) g where id = %s order by 1 $$, :'bowling_id'),
  $$ values (20, 'Jonas Holm'), (40, null) $$,
  'a Konkurrence row holds every Gebyr it charged, with who annulled one');

-- ---------- One Medlem's rows: gave, received, paid or was charged ----------
select results_eq(
  format($$ select art from public.aktivitet where involverede @> array[%L::uuid] order by id $$, :'emil'),
  $$ values ('boeder_givet'), ('konkurrence') $$,
  'filtering on a Medlem keeps the rows they gave, received or were charged on');

-- ---------- Another box sees nothing ----------
select tests.log_ud();
select tests.opret_bodekasse('Kasse B') as kasse_b \gset
select tests.opret_medlem_med_login(:'kasse_b', 'Bo Fremmed') as bo \gset
select tests.log_ind_som_medlem(:'bo');
select is((select count(*)::int from public.aktivitet) + (select count(*)::int from public.aktivitet_bode), 0,
  'a Medlem of another box sees no feed entries and no Bøder');

select * from finish();
rollback;
