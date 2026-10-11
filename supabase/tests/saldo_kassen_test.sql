-- Saldo = Bøder you bear + Gebyrer - Indbetalinger, across all Sæsoner.
-- Kassen = Indbetalinger - Hævninger, across all Sæsoner. Annulled rows never count.
begin;
\ir _hjaelpere.psql
select plan(4);

select tests.opret_bodekasse() as kasse \gset
select tests.opret_medlem_med_login(:'kasse', 'Anna', true) as anna \gset
select tests.opret_medlem_med_login(:'kasse', 'Bo') as bo \gset
select tests.opret_medlem_med_login(:'kasse', 'Carl') as carl \gset
select (select seneste_saeson_id from public.bodekasse_saeson where bodekasse_id = :'kasse') as s1 \gset

-- Sæson 1
select tests.giv_bode(:'bo', :'anna', 50);                          -- Anna bears 50
-- annulled
select tests.giv_bode(:'bo', :'anna', 30) as annulleret \gset
update public.bode set annulleret = now(), annulleret_af = :'anna' where id = :'annulleret';
-- pending Anke: nobody bears it
select tests.giv_bode(:'bo', :'anna', 20) as anket \gset
select tests.anke(:'anket');
-- won Anke: Bo bears 40
select tests.giv_bode(:'bo', :'anna', 40) as vundet \gset
select tests.anke(:'vundet', 'modtager_vandt');

insert into public.gebyr (bodekasse_id, saeson_id, medlem_id, art, beloeb, bode_id)
values (:'kasse', :'s1', :'bo', 'engangsbode', 10, :'vundet');       -- Bo pays 10
insert into public.gebyr (bodekasse_id, saeson_id, medlem_id, art, beloeb, bode_id,
                          annulleret, annulleret_af)
values (:'kasse', :'s1', :'anna', 'engangsbode', 25, :'annulleret', now(), :'anna');  -- annulled

insert into public.indbetaling (bodekasse_id, saeson_id, medlem_id, beloeb, registreret_af)
values (:'kasse', :'s1', :'anna', 100, :'anna');                     -- Anna paid 100
insert into public.indbetaling (bodekasse_id, saeson_id, medlem_id, beloeb, registreret_af,
                                annulleret, annulleret_af)
values (:'kasse', :'s1', :'anna', 70, :'anna', now(), :'anna');      -- annulled

insert into public.haevning (bodekasse_id, saeson_id, beloeb, formaal, registreret_af)
values (:'kasse', :'s1', 30, 'Øl', :'anna');
insert into public.haevning (bodekasse_id, saeson_id, beloeb, formaal, registreret_af,
                             annulleret, annulleret_af)
values (:'kasse', :'s1', 500, 'Fejl', :'anna', now(), :'anna');     -- annulled

-- Sæson 2: Saldo carries over.
update public.saeson set afsluttet = now() where id = :'s1';
insert into public.saeson (bodekasse_id, navn) values (:'kasse', 'Sæson 2');
select tests.giv_bode(:'anna', :'bo', 15);                          -- Bo bears 15
insert into public.indbetaling (bodekasse_id, saeson_id, medlem_id, beloeb, registreret_af)
values (:'kasse', (select seneste_saeson_id from public.bodekasse_saeson where bodekasse_id = :'kasse'), :'carl', 20, :'anna');  -- Carl paid 20

select tests.log_ind_som_medlem(:'carl');

select results_eq(
  $$ select m.navn, s.saldo from public.medlem_saldo s
       join public.medlem m on m.id = s.medlem_id order by m.navn $$,
  $$ values ('Anna', -50), ('Bo', 65), ('Carl', -20) $$,
  'Saldo counts borne Bøder, Gebyrer and Indbetalinger across Sæsoner, never annulled ones');

select results_eq(
  $$ select indbetalt, haevet, beloeb from public.kassen $$,
  $$ values (120, 30, 90) $$,
  'Kassen is Indbetalinger minus Hævninger across Sæsoner, never annulled ones');

-- Another box sees neither.
select tests.opret_bodekasse('Anden') as anden \gset
select tests.opret_medlem_med_login(:'anden', 'Fremmed') as fremmed \gset
select tests.log_ind_som_medlem(:'fremmed');
select results_eq($$ select saldo from public.medlem_saldo $$, $$ values (0) $$,
  'another box sees only its own Saldi');
select results_eq($$ select beloeb from public.kassen $$, $$ values (0) $$,
  'another box sees only its own Kassen');

select * from finish();
rollback;
