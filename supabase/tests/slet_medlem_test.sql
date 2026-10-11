-- slet_medlem and the medlem_slet_grund view: an Admin deletes a Medlem who
-- never logged in and has no Bøder, Gebyrer, Indbetalinger or other history.
begin;
\ir _hjaelpere.psql
select plan(13);

select tests.opret_bodekasse('Kasse A') as a \gset
select tests.opret_bodekasse('Kasse B') as b \gset
select tests.opret_medlem_med_login(:'a', 'Mads', true) as mads \gset
select tests.opret_medlem_med_login(:'a', 'Jonas') as jonas \gset
select tests.opret_medlem(:'a', 'Sebastian', 'sebastian@test.dk') as sebastian \gset
select tests.opret_medlem(:'a', 'Emil', 'emil@test.dk') as emil \gset
select tests.opret_medlem(:'a', 'Kasper', 'kasper@test.dk') as kasper \gset
select tests.opret_medlem(:'a', 'Lucas', 'lucas@test.dk') as lucas \gset
select tests.opret_medlem(:'a', 'Oliver', 'oliver@test.dk') as oliver \gset
select tests.opret_medlem_med_login(:'b', 'Bo', true) as bo \gset
select tests.giv_bode(:'mads', :'emil') as bode \gset
select tests.opret_bodekategori(:'mads', 'For sent', 50) as kat \gset
-- Kasper: a creation Gebyr (as if he made a Bødekategori); Lucas: an Indbetaling.
insert into public.gebyr (bodekasse_id, saeson_id, medlem_id, art, beloeb, bodekategori_id)
values (:'a', (select seneste_saeson_id from public.bodekasse_saeson where bodekasse_id = :'a'), :'kasper', 'oprettelse', 25, :'kat');
insert into public.indbetaling (bodekasse_id, saeson_id, medlem_id, beloeb, registreret_af)
values (:'a', (select seneste_saeson_id from public.bodekasse_saeson where bodekasse_id = :'a'), :'lucas', 50, :'mads');
-- Viktor is added through the RPC (so he has a 'medlem_tilfoejet' entry).
select tests.log_ind_som_medlem(:'mads');
select (public.tilfoej_medlem(gen_random_uuid(), :'a', 'Viktor', 'viktor@test.dk'))->>'medlem_id' as viktor \gset

select results_eq(
  format($$ select medlem_id, grund from public.medlem_slet_grund
             where bodekasse_id = %L order by medlem_id $$, :'a'),
  format($$ select * from (values (%L::uuid, 'logget_ind'::text), (%L::uuid, 'logget_ind'), (%L::uuid, null),
                                  (%L::uuid, 'boeder'), (%L::uuid, 'gebyrer'), (%L::uuid, 'indbetalinger'),
                                  (%L::uuid, null), (%L::uuid, null)) v order by 1 $$,
         :'mads', :'jonas', :'sebastian', :'emil', :'kasper', :'lucas', :'oliver', :'viktor'),
  'medlem_slet_grund says why each Medlem can''t be deleted (null = can)');

select throws_ok(format($$ select public.slet_medlem(gen_random_uuid(), %L, %L) $$, :'a', :'jonas'),
  'P0001', 'medlem_logget_ind', 'a Medlem who logged in can''t be deleted');
select throws_ok(format($$ select public.slet_medlem(gen_random_uuid(), %L, %L) $$, :'a', :'emil'),
  'P0001', 'medlem_har_boeder', 'a Medlem with Bøder can''t be deleted');
select throws_ok(format($$ select public.slet_medlem(gen_random_uuid(), %L, %L) $$, :'a', :'kasper'),
  'P0001', 'medlem_har_gebyrer', 'a Medlem with Gebyrer can''t be deleted');
select throws_ok(format($$ select public.slet_medlem(gen_random_uuid(), %L, %L) $$, :'a', :'lucas'),
  'P0001', 'medlem_har_indbetalinger', 'a Medlem with Indbetalinger can''t be deleted');
select throws_ok(format($$ select public.slet_medlem(gen_random_uuid(), %L, %L) $$, :'a', :'bo'),
  'P0001', 'medlem_ukendt', 'a Medlem of another box is unknown here');

select is(public.slet_medlem(gen_random_uuid(), :'a', :'sebastian'), '{}'::jsonb, 'an Admin deletes a clean Medlem');
select is_empty(format($$ select 1 from public.medlem where id = %L $$, :'sebastian'), 'the Medlem is gone');

select public.slet_medlem(gen_random_uuid(), :'a', :'viktor');
select is_empty(format($$ select 1 from public.medlem where id = %L $$, :'viktor'),
  'a Medlem added by mistake through Tilføj is deleted too');
select is_empty(format($$ select 1 from public.haendelse where modtager_id = %L or ref_id = %L $$, :'viktor', :'viktor'),
  'with its "added" feed entry');

-- An Udmeldt + Genoptaget Medlem has history.
select public.udmeld(gen_random_uuid(), :'a', :'oliver');
select throws_ok(format($$ select public.slet_medlem(gen_random_uuid(), %L, %L) $$, :'a', :'oliver'),
  'P0001', 'medlem_har_historik', 'a Medlem with other history can''t be deleted');
select is((select grund from public.medlem_slet_grund where medlem_id = :'oliver'), 'historik',
  'the view says historik');

select tests.log_ind_som_medlem(:'jonas');
select throws_ok(format($$ select public.slet_medlem(gen_random_uuid(), %L, %L) $$, :'a', :'oliver'),
  '42501', 'ikke_admin', 'a plain Medlem can''t delete anyone');

select * from finish();
rollback;
