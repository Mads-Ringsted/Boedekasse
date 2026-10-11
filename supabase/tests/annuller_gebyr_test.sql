-- Annulling a single Gebyr (#62): an Admin annuls a creation Gebyr or an
-- Anke Gebyr, with an optional note, once. Other Gebyrer go with their cause
-- (Engangsbøde, Frikøb, Konkurrence). Latest Sæson only, Pause included.
begin;
\ir _hjaelpere.psql
select plan(9);

select tests.opret_bodekasse() as kasse \gset
select tests.opret_medlem_med_login(:'kasse', 'Anna', true) as anna \gset
select tests.opret_medlem_med_login(:'kasse', 'Bo') as bo \gset
select private.seneste_saeson(:'kasse') as s1 \gset

-- Bo created "For sent" and paid a 25 kr creation Gebyr.
select tests.opret_bodekategori(:'bo', 'For sent', 50) as for_sent \gset
insert into public.gebyr (bodekasse_id, saeson_id, medlem_id, art, beloeb, bodekategori_id)
values (:'kasse', :'s1', :'bo', 'oprettelse', 25, :'for_sent') returning id as g1 \gset
insert into public.haendelse (bodekasse_id, saeson_id, aktoer_id, art, data, ref_tabel, ref_id)
values (:'kasse', :'s1', :'bo', 'bodekategori_oprettet', '{"navn":"For sent","pris":50}', 'bodekategori', :'for_sent');

select tests.log_ind_som_medlem(:'anna');
select public.annuller_gebyr(gen_random_uuid(), :'g1', ' Vi giver den ');
select results_eq(
  format($$ select (select saldo from public.medlem_saldo where medlem_id = %L),
                   (select boeder_i_alt from public.medlem_saeson_tal where medlem_id = %L),
                   (select annulleret_af from public.gebyr where id = %L),
                   (select annulleret_note from public.gebyr where id = %L) $$, :'bo', :'bo', :'g1', :'g1'),
  format($$ values (0, 0, %L::uuid, 'Vi giver den') $$, :'anna'),
  'an Admin annuls a creation Gebyr: it stays, marked with who and the note, and leaves Saldo and Bøder i alt');

select results_eq(
  $$ select art, aktoer_id, modtager_id, ref_tabel, ref_id, data->>'gebyr_id', data->>'art',
            data->>'navn', (data->>'beloeb')::int, data->>'note'
       from public.haendelse where art = 'gebyr_annulleret' $$,
  format($$ values ('gebyr_annulleret', %L::uuid, %L::uuid, null::text, null::uuid, %L,
                    'oprettelse', 'For sent', 25, 'Vi giver den') $$, :'anna', :'bo', :'g1'),
  'the annulment adds its own feed row about the Gebyr, without pointing at it as its subject');

select results_eq(
  $$ select art, annulleret is not null, gebyrer->0->>'annulleret' is not null, gebyrer->0->>'annulleret_af_navn'
       from public.aktivitet order by id $$,
  $$ values ('bodekategori_oprettet', false, true, 'Anna'), ('gebyr_annulleret', false, false, null) $$,
  'the creation row stays, with its Gebyr shown annulled; the annulment is a plain new row');

select throws_ok(
  format($$ select public.annuller_gebyr(gen_random_uuid(), %L) $$, :'g1'),
  'P0001', 'allerede_annulleret', 'a Gebyr cannot be annulled twice');

-- An Anke Gebyr can be annulled too.
select tests.log_ud();
select tests.giv_bode(:'anna', :'bo', 50) as b1 \gset
select tests.anke(:'b1') as anke1 \gset
insert into public.gebyr (bodekasse_id, saeson_id, medlem_id, art, beloeb, anke_id)
values (:'kasse', :'s1', :'bo', 'anke', 37, :'anke1') returning id as g2 \gset
select tests.log_ind_som_medlem(:'anna');
select public.annuller_gebyr(gen_random_uuid(), :'g2');
select results_eq(
  format($$ select annulleret is not null, (select data->>'navn' from public.haendelse
                                            where art = 'gebyr_annulleret' and data->>'gebyr_id' = %L)
              from public.gebyr where id = %L $$, :'g2', :'g2'),
  $$ values (true, 'Test') $$,
  'an Admin annuls an Anke Gebyr; the feed row names the appealed Bøde');

-- An Engangsbøde Gebyr goes only with its Bøde.
select tests.log_ud();
select tests.giv_bode(:'bo', :'anna', 100) as e1 \gset
insert into public.gebyr (bodekasse_id, saeson_id, medlem_id, art, beloeb, bode_id)
values (:'kasse', :'s1', :'bo', 'engangsbode', 10, :'e1') returning id as g3 \gset
select tests.log_ind_som_medlem(:'anna');
select throws_ok(
  format($$ select public.annuller_gebyr(gen_random_uuid(), %L) $$, :'g3'),
  'P0001', 'kan_ikke_annulleres', 'an Engangsbøde Gebyr cannot be annulled on its own');

-- Only Admins.
select tests.log_ud();
select tests.opret_bodekategori(:'bo', 'Hygge', 30) as hygge \gset
insert into public.gebyr (bodekasse_id, saeson_id, medlem_id, art, beloeb, bodekategori_id)
values (:'kasse', :'s1', :'bo', 'oprettelse', 25, :'hygge') returning id as g4 \gset
select tests.log_ind_som_medlem(:'bo');
select throws_ok(
  format($$ select public.annuller_gebyr(gen_random_uuid(), %L) $$, :'g4'),
  '42501', 'ikke_admin', 'a plain Medlem cannot annul a Gebyr, not even their own');

-- In a Pause the ended Sæson is still the latest, so annulling works.
select tests.log_ud();
update public.saeson set afsluttet = now() where id = :'s1';
select tests.log_ind_som_medlem(:'anna');
select public.annuller_gebyr(gen_random_uuid(), :'g4');
select results_eq(
  format($$ select annulleret is not null from public.gebyr where id = %L $$, :'g4'),
  $$ values (true) $$,
  'an Admin can annul a Gebyr in a Pause');

-- Once the next Sæson starts, the old one is read-only.
select tests.log_ud();
select tests.opret_bodekategori(:'bo', 'Spildt', 20) as spildt \gset
insert into public.gebyr (bodekasse_id, saeson_id, medlem_id, art, beloeb, bodekategori_id)
values (:'kasse', :'s1', :'bo', 'oprettelse', 25, :'spildt') returning id as g5 \gset
insert into public.saeson (bodekasse_id, navn) values (:'kasse', 'Sæson 2');
select tests.log_ind_som_medlem(:'anna');
select throws_ok(
  format($$ select public.annuller_gebyr(gen_random_uuid(), %L) $$, :'g5'),
  'P0001', 'tidligere_saeson', 'a Gebyr from a past Sæson cannot be annulled');

select * from finish();
rollback;
