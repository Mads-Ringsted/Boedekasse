-- #67: an Admin ends the Sæson (by date or at once), the box is in Pause, and
-- an Admin starts the next Sæson. Saldo and Kassen carry over.
begin;
\ir _hjaelpere.psql
select plan(35);

select tests.opret_bodekasse() as kasse \gset
select id as foerste from public.saeson where bodekasse_id = :'kasse' \gset
select tests.opret_medlem_med_login(:'kasse', 'Mads', true) as mads \gset
select tests.opret_medlem_med_login(:'kasse', 'Jonas') as jonas \gset
select tests.opret_medlem_med_login(:'kasse', 'Emil') as emil \gset
select tests.opret_bodekategori(:'mads', 'For sent', 50) as for_sent \gset
select tests.opret_bodekasse('Anden kasse') as anden_kasse \gset
select tests.opret_medlem_med_login(:'anden_kasse', 'Fremmed', true) as fremmed \gset

create function tests.giv(p_kasse uuid, p_modtager uuid, p_kategori uuid) returns jsonb
language sql as $$
  select public.giv_boeder(gen_random_uuid(), p_kasse,
    jsonb_build_array(jsonb_build_object('modtager_id', p_modtager, 'bodekategori_id', p_kategori, 'antal', 1)))
$$;
grant execute on function tests.giv(uuid, uuid, uuid) to authenticated;

-- Sæson 1: Jonas owes 50 kr and pays 20 kr; Emil appeals a 30 kr Bøde (open).
select tests.log_ind_som_medlem(:'emil');
select tests.giv(:'kasse', :'jonas', :'for_sent');
select tests.log_ud();
insert into public.indbetaling (bodekasse_id, saeson_id, medlem_id, beloeb, registreret_af)
values (:'kasse', :'foerste', :'jonas', 20, :'mads');
select tests.giv_bode(:'mads', :'emil', 30) as anket_bode \gset
select tests.anke(:'anket_bode');

-- ---------- Afslut sæson nu ----------
select tests.log_ind_som_medlem(:'jonas');
select throws_ok(
  format($$ select public.afslut_saeson(gen_random_uuid(), %L) $$, :'kasse'),
  '42501', 'ikke_admin', 'a Medlem who is not Admin cannot end the Sæson');

select tests.log_ind_som_medlem(:'fremmed');
select throws_ok(
  format($$ select public.afslut_saeson(gen_random_uuid(), %L) $$, :'kasse'),
  '42501', 'ikke_medlem', 'an Admin of another box cannot end the Sæson');

select tests.log_ind_som_medlem(:'mads');
select gen_random_uuid() as afslut_id \gset
select public.afslut_saeson(:'afslut_id', :'kasse');
select results_eq(
  format($$ select aktiv_saeson_id, seneste_saeson_id, pause from public.bodekasse_saeson
             where bodekasse_id = %L $$, :'kasse'),
  format($$ values (null::uuid, %L::uuid, true) $$, :'foerste'),
  'Afslut sæson nu puts the box in Pause; the ended Sæson stays the latest');

select lives_ok(
  format($$ select public.afslut_saeson(%L, %L) $$, :'afslut_id', :'kasse'),
  'a repeat with the same one-time ID is ignored');

select throws_ok(
  format($$ select public.afslut_saeson(gen_random_uuid(), %L) $$, :'kasse'),
  'P0001', 'pause', 'a Sæson that has ended cannot be ended again');

select results_eq(
  format($$ select art, aktoer_id, data ->> 'saeson_navn' from public.aktivitet
             where bodekasse_id = %L and saeson_id = %L and art = 'saeson_afsluttet' $$,
         :'kasse', :'foerste'),
  format($$ values ('saeson_afsluttet', %L::uuid, 'Sæson 1') $$, :'mads'),
  'the feed shows one "Sæson ended" entry by the Admin');

-- ---------- Pause: no Bøder or Gebyrer, money still moves ----------
select tests.log_ind_som_medlem(:'jonas');
select throws_ok(
  format($$ select tests.giv(%L, %L, %L) $$, :'kasse', :'emil', :'for_sent'),
  'P0001', 'pause', 'Giv bøder is rejected in a Pause');

select throws_ok(
  format($$ select public.giv_boeder(gen_random_uuid(), %L, jsonb_build_array(
             jsonb_build_object('modtager_id', %L::uuid, 'grund', 'Glemte kampen', 'beloeb', 40))) $$,
         :'kasse', :'emil'),
  'P0001', 'pause', 'an Engangsbøde is rejected in a Pause');

select tests.log_ind_som_medlem(:'mads');
select public.registrer_indbetaling(gen_random_uuid(), :'kasse', :'mads', 10) ->> 'indbetaling_id' as pause_betaling \gset
select results_eq(
  format($$ select i.saeson_id, k.beloeb from public.indbetaling i join public.kassen k using (bodekasse_id)
             where i.id = %L $$, :'pause_betaling'),
  format($$ values (%L::uuid, 30) $$, :'foerste'),
  'an Indbetaling works in a Pause and gets the ended (latest) Sæson');

select tests.log_ud();
update public.bodekasse set oprettelsesgebyr_til = true where id = :'kasse';
select tests.log_ind_som_medlem(:'jonas');
select public.opret_bodekategori(gen_random_uuid(), :'kasse', 'Glemt kridt', 20, null);
select is(
  (select saldo from public.medlem_saldo where medlem_id = :'jonas'), 30,
  'a Bødekategori can be created in a Pause, with no creation Gebyr');

select tests.log_ud();
update public.bodekasse set oprettelsesgebyr_til = false where id = :'kasse';

-- ---------- Start ny sæson ----------
select 'Sæson ' || extract(year from now() at time zone 'Europe/Copenhagen')::int as aarets_navn \gset

select tests.log_ind_som_medlem(:'jonas');
select throws_ok(
  format($$ select public.start_saeson(gen_random_uuid(), %L) $$, :'kasse'),
  '42501', 'ikke_admin', 'a Medlem who is not Admin cannot start a Sæson');

select tests.log_ind_som_medlem(:'mads');
select gen_random_uuid() as start_id \gset
select public.start_saeson(:'start_id', :'kasse') ->> 'saeson_id' as anden \gset
select results_eq(
  format($$ select aktiv_saeson_id, pause from public.bodekasse_saeson where bodekasse_id = %L $$, :'kasse'),
  format($$ values (%L::uuid, false) $$, :'anden'),
  'Start ny sæson ends the Pause with a new running Sæson');

select is(
  public.start_saeson(:'start_id', :'kasse') ->> 'saeson_id', :'anden',
  'a repeat with the same one-time ID gives the same Sæson and starts no other');

select results_eq(
  format($$ select navn from public.saeson_status where bodekasse_id = %L order by loebenr $$, :'kasse'),
  format($$ values ('Sæson 1'), (%L) $$, :'aarets_navn'),
  'the new Sæson is named "Sæson <year>"');

select results_eq(
  format($$ select afgoerelse::text, baerer_id from public.bode_baerer where id = %L $$, :'anket_bode'),
  format($$ values ('ikke_afgjort', %L::uuid) $$, :'emil'),
  'an open Anke closes as ikke_afgjort and the receiver bears the Bøde');

select set_eq(
  format($$ select medlem_id, saldo from public.medlem_saldo where bodekasse_id = %L $$, :'kasse'),
  format($$ values (%L::uuid, -10), (%L::uuid, 30), (%L::uuid, 30) $$, :'mads', :'jonas', :'emil'),
  'Saldo carries over into the new Sæson');

select is(
  (select beloeb from public.kassen where bodekasse_id = :'kasse'), 30,
  'Kassen carries over into the new Sæson');

select results_eq(
  format($$ select sum(boeder_i_alt)::int, sum(indbetalt)::int, max(plads)::int from public.topliste
             where saeson_id = %L $$, :'anden'),
  $$ values (0, 0, 1) $$,
  'the new Sæson''s Topliste starts fresh');

select is(
  (select antal from public.bodekategori_brug where saeson_id = :'anden' and bodekategori_id = :'for_sent'), 0,
  'Bødekategori use counts start fresh');

select results_eq(
  format($$ select art, aktoer_id, data ->> 'saeson_navn' from public.aktivitet where saeson_id = %L $$, :'anden'),
  format($$ values ('saeson_startet', %L::uuid, %L) $$, :'mads', :'aarets_navn'),
  'the new Sæson''s feed starts fresh with "Sæson started"');

select is(
  (select count(*)::int from public.aktivitet where saeson_id = :'foerste' and art = 'saeson_afsluttet'), 1,
  'starting after Afslut sæson nu writes no second "Sæson ended"');

select tests.log_ind_som_medlem(:'emil');
select lives_ok(
  format($$ select tests.giv(%L, %L, %L) $$, :'kasse', :'jonas', :'for_sent'),
  'Bøder can be given again in the new Sæson');

-- Starting during a running Sæson ends it and starts the next in one step.
select tests.log_ind_som_medlem(:'mads');
select public.start_saeson(gen_random_uuid(), :'kasse') ->> 'saeson_id' as tredje \gset
select results_eq(
  format($$ select id, koerer from public.saeson_status where bodekasse_id = %L and loebenr >= (
             select loebenr from public.saeson where id = %L) order by loebenr $$, :'kasse', :'anden'),
  format($$ values (%L::uuid, false), (%L::uuid, true) $$, :'anden', :'tredje'),
  'starting during a running Sæson ends it and runs the new one');
select results_eq(
  format($$ select aktoer_id from public.aktivitet where saeson_id = %L and art = 'saeson_afsluttet' $$, :'anden'),
  format($$ values (%L::uuid) $$, :'mads'),
  'the ended Sæson gets a "Sæson ended" entry by the Admin');

-- A Sæson that ended by its date gets its "Sæson ended" entry at the next start.
select tests.log_ud();
update public.saeson set slutdato = (now() at time zone 'Europe/Copenhagen')::date - 1 where id = :'tredje';
select tests.log_ind_som_medlem(:'mads');
select public.start_saeson(gen_random_uuid(), :'kasse') ->> 'saeson_id' as fjerde \gset
select results_eq(
  format($$ select aktoer_id, data ->> 'saeson_navn' from public.aktivitet
             where saeson_id = %L and art = 'saeson_afsluttet' $$, :'tredje'),
  format($$ values (null::uuid, %L) $$, :'aarets_navn'),
  'a Sæson ended by its date gets a "Sæson ended" entry with no Admin');
select is(
  (select tid from public.aktivitet where saeson_id = :'tredje' and art = 'saeson_afsluttet'),
  ((now() at time zone 'Europe/Copenhagen')::date)::timestamp at time zone 'Europe/Copenhagen',
  'that entry is dated when the Sæson ended (Copenhagen midnight after its slutdato), not when it was written');

-- ---------- End date and name ----------
select (now() at time zone 'Europe/Copenhagen')::date as i_dag \gset

select tests.log_ind_som_medlem(:'jonas');
select throws_ok(
  format($$ select public.saet_slutdato(gen_random_uuid(), %L, %L) $$, :'kasse', :'i_dag'),
  '42501', 'ikke_admin', 'a Medlem who is not Admin cannot set the end date');
select throws_ok(
  format($$ select public.omdoeb_saeson(gen_random_uuid(), %L, 'Vores sæson') $$, :'kasse'),
  '42501', 'ikke_admin', 'a Medlem who is not Admin cannot rename the Sæson');

select tests.log_ind_som_medlem(:'mads');
select public.saet_slutdato(gen_random_uuid(), :'kasse', (:'i_dag'::date + 30));
select results_eq(
  format($$ select slutdato, koerer from public.saeson_status where id = %L $$, :'fjerde'),
  format($$ values (%L::date + 30, true) $$, :'i_dag'),
  'an Admin sets the end date; the Sæson runs until then');

select public.saet_slutdato(gen_random_uuid(), :'kasse', :'i_dag');
select is((select pause from public.bodekasse_saeson where bodekasse_id = :'kasse'), false,
  'an end date of today is allowed, and the Sæson still runs today');

select throws_ok(
  format($$ select public.saet_slutdato(gen_random_uuid(), %L, %L::date - 1) $$, :'kasse', :'i_dag'),
  'P0001', 'slutdato_ugyldig', 'the end date cannot be in the past (use Afslut sæson nu)');

select public.saet_slutdato(gen_random_uuid(), :'kasse', null);
select is((select slutdato from public.saeson_status where id = :'fjerde'), null,
  'an Admin can clear the end date');

select throws_ok(
  format($$ select public.omdoeb_saeson(gen_random_uuid(), %L, '   ') $$, :'kasse'),
  'P0001', 'navn_mangler', 'a Sæson needs a name');

select public.afslut_saeson(gen_random_uuid(), :'kasse');
select throws_ok(
  format($$ select public.saet_slutdato(gen_random_uuid(), %L, %L) $$, :'kasse', :'i_dag'),
  'P0001', 'pause', 'the end date cannot be set in a Pause');

select public.omdoeb_saeson(gen_random_uuid(), :'kasse', '  Sæson 2026/27 ');
select results_eq(
  format($$ select navn, er_seneste from public.saeson_status where id = %L $$, :'fjerde'),
  $$ values ('Sæson 2026/27', true) $$,
  'an Admin renames the latest Sæson, also in a Pause');

select * from finish();
rollback;
