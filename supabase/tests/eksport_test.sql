-- Eksportér data (#70): an Admin gets every Bøde, Gebyr, Indbetaling and
-- Hævning of one Sæson, oldest first, ready to write as CSV.
begin;
\ir _hjaelpere.psql
select plan(8);

select tests.opret_bodekasse() as kasse \gset
select id as saeson1 from public.saeson where bodekasse_id = :'kasse' \gset
select tests.opret_medlem_med_login(:'kasse', 'Anna', true) as anna \gset
select tests.opret_medlem_med_login(:'kasse', 'Bo') as bo \gset
select tests.opret_medlem(:'kasse', 'Carl') as carl \gset

-- Sæson 1: a Bøde for "For sent", an Engangsbøde, a creation Gebyr, an Anke
-- Gebyr, an Indbetaling and a Hævning.
select tests.opret_bodekategori(:'anna', 'For sent', 50) as for_sent \gset
select tests.giv_bode(:'anna', :'bo', 50, :'for_sent') as bode1 \gset
select tests.giv_bode(:'bo', :'carl', 75) as engang \gset
select tests.anke(:'bode1', 'modtager_vandt') as anke1 \gset
select private.opret_gebyr(:'kasse', :'anna', 'oprettelse', 25, :'for_sent') as gebyr1 \gset
select private.opret_gebyr(:'kasse', :'bo', 'anke', 10, :'anke1') as gebyr2 \gset

select tests.log_ind_som_medlem(:'anna');
select (public.registrer_indbetaling(gen_random_uuid(), :'kasse', :'bo', 100, 'Kontant')
        ->>'indbetaling_id') as ind1 \gset
select (public.haev(gen_random_uuid(), :'kasse', 40, 'Bowling')->>'haevning_id') as haev1 \gset
select public.annuller_indbetaling(gen_random_uuid(), :'ind1', 'Forkert beløb');
select tests.log_ud();

-- Everything happened in one transaction: spread it over the day so the
-- order is known.
update public.bodekategori set oprettet = '2026-03-01 09:00+01' where id = :'for_sent';
update public.bode set givet = '2026-03-02 10:00+01' where id = :'bode1';
update public.bode set givet = '2026-03-03 11:00+01' where id = :'engang';
update public.gebyr set oprettet = '2026-03-01 09:00+01' where id = :'gebyr1';
update public.gebyr set oprettet = '2026-03-04 12:00+01' where id = :'gebyr2';
update public.indbetaling set registreret = '2026-03-05 13:00+01' where id = :'ind1';
update public.haevning set registreret = '2026-03-06 14:00+01' where id = :'haev1';

-- Sæson 2 has one Bøde of its own.
insert into public.saeson (bodekasse_id, navn) values (:'kasse', 'Sæson 2') returning id as saeson2 \gset
select tests.giv_bode(:'anna', :'carl', 30) as bode2 \gset

select tests.log_ind_som_medlem(:'anna');

select results_eq(
  format($$ select art, gebyr_art::text, medlem, af, hvad, beloeb
              from public.eksport_saeson(%L, %L) $$, :'kasse', :'saeson1'),
  $$ values ('gebyr',       'oprettelse', 'Anna', null,   'For sent', 25),
            ('bode',        null,         'Bo',   'Anna', 'For sent', 50),
            ('engangsbode', null,         'Carl', 'Bo',   'Test',     75),
            ('gebyr',       'anke',       'Bo',   null,   'For sent', 10),
            ('indbetaling', null,         'Bo',   'Anna', 'Kontant',  100),
            ('haevning',    null,         null,   'Anna', 'Bowling',  40) $$,
  'an Admin gets every Bøde, Gebyr, Indbetaling and Hævning of the Sæson, oldest first');

select results_eq(
  format($$ select tid from public.eksport_saeson(%L, %L) where art = 'bode' $$, :'kasse', :'saeson1'),
  $$ values ('2026-03-02 10:00+01'::timestamptz) $$,
  'each row carries the time it happened');

select results_eq(
  format($$ select art, annulleret is not null, annulleret_note
              from public.eksport_saeson(%L, %L) where annulleret is not null $$, :'kasse', :'saeson1'),
  $$ values ('indbetaling', true, 'Forkert beløb') $$,
  'an annulled row stays in, marked annulled with its note');

select results_eq(
  format($$ select art, anke from public.eksport_saeson(%L, %L)
             where art in ('bode', 'engangsbode') $$, :'kasse', :'saeson1'),
  $$ values ('bode', 'modtager_vandt'), ('engangsbode', null) $$,
  'a Bøde shows how its Anke ended');

select results_eq(
  format($$ select art, medlem, beloeb from public.eksport_saeson(%L, %L) $$, :'kasse', :'saeson2'),
  $$ values ('engangsbode', 'Carl', 30) $$,
  'another Sæson exports only its own rows');

-- A pending Anke reads 'afventer'.
select tests.log_ud();
select tests.anke(:'bode2') as anke2 \gset
select tests.log_ind_som_medlem(:'anna');
select results_eq(
  format($$ select anke from public.eksport_saeson(%L, %L) $$, :'kasse', :'saeson2'),
  $$ values ('afventer') $$,
  'a Bøde with an open Anke reads afventer');

-- Admin only.
select tests.log_ind_som_medlem(:'bo');
select throws_ok(
  format($$ select * from public.eksport_saeson(%L, %L) $$, :'kasse', :'saeson1'),
  '42501', 'ikke_admin', 'only an Admin can export');

-- A Sæson from another box is unknown here.
select tests.log_ud();
select tests.opret_bodekasse('Anden') as anden \gset
select id as anden_saeson from public.saeson where bodekasse_id = :'anden' \gset
select tests.log_ind_som_medlem(:'anna');
select throws_ok(
  format($$ select * from public.eksport_saeson(%L, %L) $$, :'kasse', :'anden_saeson'),
  'P0001', 'ikke_fundet', 'a Sæson from another box cannot be exported');

select * from finish();
rollback;
