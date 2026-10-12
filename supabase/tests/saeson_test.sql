-- Running Sæson vs Pause. The running Sæson is the latest one, not ended, and
-- before midnight (Europe/Copenhagen) after its slutdato. No running Sæson = Pause.
begin;
\ir _hjaelpere.psql
select plan(9);

select tests.opret_bodekasse() as kasse \gset
select id as foerste from public.saeson where bodekasse_id = :'kasse' \gset
select tests.opret_medlem_med_login(:'kasse', 'Anna') as anna \gset
-- "today" and "yesterday" as the calendar in Copenhagen sees them
select (now() at time zone 'Europe/Copenhagen')::date as i_dag \gset
select (now() at time zone 'Europe/Copenhagen')::date - 1 as i_gaar \gset

select tests.log_ind_som_medlem(:'anna');
select results_eq(
  $$ select aktiv_saeson_id, seneste_saeson_id, pause from public.bodekasse_saeson $$,
  format($$ values (%L::uuid, %L::uuid, false) $$, :'foerste', :'foerste'),
  'a new box has a running first Sæson');

select is(
  (select slutter from public.saeson_status where id = :'foerste'), null,
  'a Sæson with no end date has no end time');

select tests.log_ud();
update public.saeson set slutdato = '2026-10-11' where id = :'foerste';
select tests.log_ind_som_medlem(:'anna');
select is((select slutter from public.saeson_status where id = :'foerste'),
  '2026-10-11 22:00:00+00'::timestamptz,
  'a summer slutdato ends at Copenhagen midnight after it (22:00 UTC)');

select tests.log_ud();
update public.saeson set slutdato = '2026-12-24' where id = :'foerste';
select tests.log_ind_som_medlem(:'anna');
select is((select slutter from public.saeson_status where id = :'foerste'),
  '2026-12-24 23:00:00+00'::timestamptz,
  'a winter slutdato ends at Copenhagen midnight after it (23:00 UTC)');

select tests.log_ud();
update public.saeson set slutdato = :'i_dag' where id = :'foerste';
select tests.log_ind_som_medlem(:'anna');
select is((select pause from public.bodekasse_saeson), false,
  'the Sæson still runs on its slutdato');

select tests.log_ud();
update public.saeson set slutdato = :'i_gaar' where id = :'foerste';
select tests.log_ind_som_medlem(:'anna');
select results_eq(
  $$ select aktiv_saeson_id, seneste_saeson_id, pause from public.bodekasse_saeson $$,
  format($$ values (null::uuid, %L::uuid, true) $$, :'foerste'),
  'after its slutdato the box is in Pause, and the Sæson is still the latest');

select tests.log_ud();
update public.saeson set slutdato = null, afsluttet = now() where id = :'foerste';
select tests.log_ind_som_medlem(:'anna');
select is((select pause from public.bodekasse_saeson), true,
  'an afsluttet Sæson no longer runs');

-- A newer Sæson takes over; the older one never runs again.
select tests.log_ud();
insert into public.saeson (bodekasse_id, navn) values (:'kasse', 'Sæson 2') returning id as anden \gset
update public.saeson set afsluttet = null where id = :'foerste';
select tests.log_ind_som_medlem(:'anna');
select results_eq(
  $$ select aktiv_saeson_id, seneste_saeson_id, pause from public.bodekasse_saeson $$,
  format($$ values (%L::uuid, %L::uuid, false) $$, :'anden', :'anden'),
  'the newest Sæson is the running one');
select results_eq(
  $$ select navn, koerer, er_seneste from public.saeson_status order by loebenr $$,
  $$ values ('Sæson 1', false, false), ('Sæson 2', true, true) $$,
  'an older Sæson is never running');

select * from finish();
rollback;
