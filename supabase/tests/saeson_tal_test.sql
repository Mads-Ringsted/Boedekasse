-- Per-Sæson figures are the Saldo sums filtered by Sæson:
-- Bøder i alt (borne Bøder + every Gebyr kind), Indbetalt, Overført fra sidste
-- sæson, and Bødekategori use counts with the top 5 marked "Ofte brugt".
begin;
\ir _hjaelpere.psql
select plan(4);

select tests.opret_bodekasse() as kasse \gset
select tests.opret_medlem_med_login(:'kasse', 'Anna', true) as anna \gset
select tests.opret_medlem_med_login(:'kasse', 'Bo') as bo \gset
select private.seneste_saeson(:'kasse') as s1 \gset

-- Sæson 1: Anna bears 50, pays a 10 kr Gebyr and pays in 20.
select tests.giv_bode(:'bo', :'anna', 50) as b1 \gset
insert into public.gebyr (bodekasse_id, saeson_id, medlem_id, art, beloeb, bode_id)
values (:'kasse', :'s1', :'anna', 'engangsbode', 10, :'b1');
select tests.giv_bode(:'bo', :'anna', 99) as annulleret \gset
update public.bode set annulleret = now(), annulleret_af = :'bo' where id = :'annulleret';
insert into public.indbetaling (bodekasse_id, saeson_id, medlem_id, beloeb, registreret_af)
values (:'kasse', :'s1', :'anna', 20, :'anna');
select tests.opret_bodekategori(:'anna', 'Gammel', 5) as gammel \gset
select tests.giv_bode(:'anna', :'bo', 0, :'gammel');

-- Sæson 2: Anna bears 30, pays a 25 kr creation Gebyr and pays in 100.
update public.saeson set afsluttet = now() where id = :'s1';
insert into public.saeson (bodekasse_id, navn) values (:'kasse', 'Sæson 2') returning id as s2 \gset
select tests.giv_bode(:'bo', :'anna', 30);
select tests.opret_bodekategori(:'anna', 'For sent', 50) as for_sent \gset
insert into public.gebyr (bodekasse_id, saeson_id, medlem_id, art, beloeb, bodekategori_id)
values (:'kasse', :'s2', :'anna', 'oprettelse', 25, :'for_sent');
insert into public.indbetaling (bodekasse_id, saeson_id, medlem_id, beloeb, registreret_af)
values (:'kasse', :'s2', :'anna', 100, :'anna');

-- Use counts in Sæson 2: six Bødekategorier used 6, 5, 4, 3, 2, 1 times, one unused.
select tests.opret_bodekategori(:'anna', k.navn, 10)
  from (values ('K1'), ('K2'), ('K3'), ('K4'), ('K5'), ('K6'), ('Ubrugt')) k(navn);
select tests.giv_bode(:'anna', :'bo', 0, k.id)
  from public.bodekategori k
  cross join generate_series(1, 6) n
 where k.navn ~ '^K[1-6]$' and n <= 7 - substr(k.navn, 2)::int;
-- an annulled use does not count
select tests.giv_bode(:'anna', :'bo', 0, (select id from public.bodekategori where navn = 'K6')) as k6x \gset
update public.bode set annulleret = now(), annulleret_af = :'anna' where id = :'k6x';

select tests.log_ind_som_medlem(:'bo');

select results_eq(
  format($$ select boeder_i_alt, indbetalt, overfoert from public.medlem_saeson_tal
             where medlem_id = %L order by saeson_id = %L $$, :'anna', :'s2'),
  $$ values (60, 20, 0), (55, 100, 40) $$,
  'Anna''s Bøder i alt, Indbetalt and Overført per Sæson');

select results_eq(
  format($$ select boeder_i_alt, overfoert from public.medlem_saeson_tal
             where medlem_id = %L and saeson_id = %L $$, :'bo', :'s2'),
  $$ values (10 * (6+5+4+3+2+1), 5) $$,
  'Bo''s Sæson 2 counts only Sæson 2 Bøder, and carries his Sæson 1 Saldo over');

select results_eq(
  format($$ select k.navn, u.antal, u.ofte_brugt from public.bodekategori_brug u
             join public.bodekategori k on k.id = u.bodekategori_id
            where u.saeson_id = %L order by k.navn $$, :'s2'),
  $$ values ('For sent', 0, false), ('Gammel', 0, false),
            ('K1', 6, true), ('K2', 5, true), ('K3', 4, true), ('K4', 3, true),
            ('K5', 2, true), ('K6', 1, false), ('Ubrugt', 0, false) $$,
  'use counts per Sæson, with the five most used marked Ofte brugt');

select results_eq(
  format($$ select k.navn, u.antal from public.bodekategori_brug u
             join public.bodekategori k on k.id = u.bodekategori_id
            where u.saeson_id = %L and u.antal > 0 $$, :'s1'),
  $$ values ('Gammel', 1) $$,
  'use counts start fresh in each Sæson');

select * from finish();
rollback;
