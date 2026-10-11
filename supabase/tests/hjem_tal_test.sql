-- Hjem's figures: "I alt ikke betalte bøder" (kassen.ikke_betalt) and the
-- Topliste (Bøder i alt per Sæson, Betalt, place; Udmeldte left out).
begin;
\ir _hjaelpere.psql
select plan(7);

select tests.opret_bodekasse() as kasse \gset
select tests.opret_medlem_med_login(:'kasse', 'Anna', true) as anna \gset
select tests.opret_medlem_med_login(:'kasse', 'Bo') as bo \gset
select tests.opret_medlem_med_login(:'kasse', 'Carl') as carl \gset
select tests.opret_medlem_med_login(:'kasse', 'Dorte') as dorte \gset
select tests.opret_medlem(:'kasse', 'Eva') as eva \gset
select tests.opret_medlem_med_login(:'kasse', 'Udo') as udo \gset
select private.seneste_saeson(:'kasse') as s1 \gset

-- Sæson 1
select tests.giv_bode(:'bo', :'anna', 100) as b_anna \gset
select tests.giv_bode(:'anna', :'bo', 50);    -- Bo 50 ...
insert into public.gebyr (bodekasse_id, saeson_id, medlem_id, art, beloeb, bode_id)
values (:'kasse', :'s1', :'bo', 'engangsbode', 10, :'b_anna');  -- ... + 10 kr Gebyr = 60
select tests.giv_bode(:'anna', :'carl', 60);  -- Carl 60 (ties with Bo)
select tests.giv_bode(:'anna', :'dorte', 20) as annulleret \gset
update public.bode set annulleret = now(), annulleret_af = :'anna' where id = :'annulleret';
select tests.giv_bode(:'anna', :'dorte', 5);  -- Dorte 5 (her 20 is annulled)
select tests.giv_bode(:'anna', :'udo', 500);  -- Udo 500, then Udmeldt
update public.medlem set udmeldt = now() - interval '2 days' where id = :'udo';

insert into public.indbetaling (bodekasse_id, saeson_id, medlem_id, beloeb, registreret_af)
values (:'kasse', :'s1', :'anna', 30, :'anna'),    -- Anna owes 70
       (:'kasse', :'s1', :'bo', 80, :'anna'),      -- Bo has 20 til gode
       (:'kasse', :'s1', :'carl', 60, :'anna');    -- Carl owes 0
insert into public.indbetaling (bodekasse_id, saeson_id, medlem_id, beloeb, registreret_af,
                                annulleret, annulleret_af)
values (:'kasse', :'s1', :'dorte', 5, :'anna', now(), :'anna');  -- annulled: Dorte owes 5

select tests.log_ind_som_medlem(:'carl');

select results_eq(
  $$ select ikke_betalt from public.kassen $$,
  $$ values (70 + 5 + 500) $$,
  'I alt ikke betalte bøder adds up what each Medlem owes, Udmeldte too; Til gode never offsets it');

select results_eq(
  format($$ select navn, boeder_i_alt, indbetalt, plads from public.topliste
             where saeson_id = %L order by plads, navn $$, :'s1'),
  $$ values ('Anna', 100, 30, 1::bigint), ('Bo', 60, 80, 2), ('Carl', 60, 60, 2),
            ('Dorte', 5, 0, 4), ('Eva', 0, 0, 5) $$,
  'the Topliste ranks active Medlemmer by Bøder i alt (Gebyrer included), ties share a place');

-- Sæson 2 starts fresh; Saldo carries over.
select tests.log_ud();
update public.saeson set afsluttet = now() - interval '1 day' where id = :'s1';
insert into public.saeson (bodekasse_id, navn) values (:'kasse', 'Sæson 2') returning id as s2 \gset
select tests.giv_bode(:'anna', :'dorte', 40);
insert into public.indbetaling (bodekasse_id, saeson_id, medlem_id, beloeb, registreret_af)
values (:'kasse', :'s2', :'anna', 70, :'anna');
select tests.log_ind_som_medlem(:'carl');

select results_eq(
  format($$ select navn, boeder_i_alt, indbetalt, plads from public.topliste
             where saeson_id = %L order by plads, navn $$, :'s2'),
  $$ values ('Dorte', 40, 0, 1::bigint), ('Anna', 0, 70, 2), ('Bo', 0, 0, 2),
            ('Carl', 0, 0, 2), ('Eva', 0, 0, 2) $$,
  'a new Sæson''s Topliste counts only its own Bøder and Indbetalinger');

-- Eva is Udmeldt in Sæson 2: she leaves its Topliste but stays in Sæson 1's.
-- Udo was Udmeldt before Sæson 1 ended, so he stays out of it.
select tests.log_ud();
update public.medlem set udmeldt = now() where id = :'eva';
select tests.log_ind_som_medlem(:'carl');
select results_eq(
  format($$ select navn, plads from public.topliste where saeson_id = %L order by plads, navn $$, :'s1'),
  $$ values ('Anna', 1::bigint), ('Bo', 2), ('Carl', 2), ('Dorte', 4), ('Eva', 5) $$,
  'a past Sæson''s Topliste stays as it ended: Udmeldt later stays in, Udmeldt during it stays out');
select results_eq(
  format($$ select navn, plads from public.topliste where saeson_id = %L order by plads, navn $$, :'s2'),
  $$ values ('Dorte', 1::bigint), ('Anna', 2), ('Bo', 2), ('Carl', 2) $$,
  'the latest Sæson''s Topliste leaves out Udmeldte');

select results_eq(
  $$ select ikke_betalt from public.kassen $$,
  $$ values (45 + 500) $$,
  'I alt ikke betalte bøder spans all Sæsoner');

-- Another box sees none of it.
select tests.log_ud();
select tests.opret_bodekasse('Anden') as anden \gset
select tests.opret_medlem_med_login(:'anden', 'Fremmed') as fremmed \gset
select tests.log_ind_som_medlem(:'fremmed');
select results_eq(
  $$ select navn, boeder_i_alt from public.topliste $$,
  $$ values ('Fremmed', 0) $$,
  'another box sees only its own Topliste');

select * from finish();
rollback;
