-- Profilbillede cleanup (#104): every way a picture stops being needed queues
-- its Storage paths in public.billede_oprydning, the hourly automation run
-- wakes the Edge Function ryd-billeder, and the function's claim and marker
-- RPCs never hand out the same deletion twice.
begin;
\ir _hjaelpere.psql
select plan(18);

select tests.opret_bodekasse('Kasse A') as a \gset
select tests.opret_bruger('mads@test.dk') as mads \gset
select tests.opret_medlem(:'a', 'Mads', null, true, :'mads') as mads_a \gset
select tests.opret_medlem_med_login(:'a', 'Anna') as anna \gset
select tests.opret_medlem(:'a', 'Pia', 'pia@test.dk') as pia \gset
select tests.opret_bodekasse('Kasse B') as b \gset
select tests.opret_medlem(:'b', 'Mads B', null, true, :'mads') as mads_b \gset
select tests.opret_medlem_med_login(:'b', 'Bo') as bo \gset

select format('%s/%s/1.webp', :'a', :'mads_a') as mit1 \gset
select format('%s/%s/2.webp', :'a', :'mads_a') as mit2 \gset
select format('%s/%s/1.webp', :'a', :'anna') as annas \gset
select format('%s/%s/1.webp', :'a', :'pia') as pias \gset
select format('%s/%s/1.webp', :'b', :'mads_b') as mit_b \gset
select format('%s/%s/9.webp', :'b', :'mads_b') as mit_b_uden \gset
select format('%s/%s/1.webp', :'b', :'bo') as bos \gset
-- Uploaded files (as the Storage API would write them). Pia's and mit_b_uden
-- were uploaded but never set as a picture.
insert into storage.objects (bucket_id, name)
values ('profilbilleder', :'mit1'), ('profilbilleder', :'mit2'), ('profilbilleder', :'annas'),
       ('profilbilleder', :'pias'), ('profilbilleder', :'mit_b'), ('profilbilleder', :'mit_b_uden'),
       ('profilbilleder', :'bos');
update public.medlem set billede_sti = :'annas' where id = :'anna';
update public.medlem set billede_sti = :'mit_b' where id = :'mads_b';
update public.medlem set billede_sti = :'bos' where id = :'bo';

create function tests.i_koe() returns setof text language sql as $$
  select sti from public.billede_oprydning where slettet is null order by sti
$$;

-- ---------- Set and replace ----------
select tests.log_ind_som(:'mads');
select public.saet_mit_billede(gen_random_uuid(), :'a', :'mit1');
select public.saet_mit_billede(gen_random_uuid(), :'a', :'mit2');
select tests.log_ud();
select results_eq('select * from tests.i_koe()', format($$ values (%L) $$, :'mit1'),
  'replacing a picture queues the old path, and setting the first one queues nothing');

select tests.log_ind_som(:'mads');
select public.saet_mit_billede(gen_random_uuid(), :'a', :'mit2');
select tests.log_ud();
select results_eq('select * from tests.i_koe()', format($$ values (%L) $$, :'mit1'),
  'setting the same picture again queues nothing');

-- ---------- Remove ----------
delete from public.billede_oprydning;
select tests.log_ind_som(:'mads');
select public.fjern_mit_billede(gen_random_uuid(), :'a');
select public.fjern_mit_billede(gen_random_uuid(), :'a');
select tests.log_ud();
select results_eq('select * from tests.i_koe()', format($$ values (%L) $$, :'mit2'),
  'removing a picture queues its path, once');

-- ---------- Udmeldt keeps the picture ----------
delete from public.billede_oprydning;
select tests.log_ind_som(:'mads');
select public.udmeld(gen_random_uuid(), :'a', :'anna');
select tests.log_ud();
select is_empty('select * from tests.i_koe()', 'Udmeldt queues nothing');
select is((select billede_sti from public.medlem where id = :'anna'), :'annas',
  'an Udmeldt Medlem keeps the picture');

-- ---------- Slet medlem ----------
select tests.log_ind_som(:'mads');
select public.slet_medlem(gen_random_uuid(), :'a', :'pia');
select tests.log_ud();
select results_eq('select * from tests.i_koe()', format($$ values (%L) $$, :'pias'),
  'Slet medlem queues every file in that Medlem''s folder');

-- ---------- Slet konto ----------
-- Mads is Udmeldt in A (so not its last Admin) and hands B over to Bo.
-- His files: mit1 and mit2 in A, mit_b and mit_b_uden in B.
delete from public.billede_oprydning;
update public.medlem set udmeldt = now() where id = :'mads_a';
update public.medlem set er_admin = true where id = :'bo';
select tests.log_ind_som(:'mads');
select public.slet_konto(gen_random_uuid());
select tests.log_ud();
select results_eq('select * from tests.i_koe()',
  format($$ select unnest(array[%L, %L, %L, %L]) order by 1 $$,
         :'mit1', :'mit2', :'mit_b', :'mit_b_uden'),
  'Slet konto queues every file of the login''s Medlemmer, Udmeldte too');
select is((select count(*)::int from public.medlem
            where id in (:'mads_a', :'mads_b') and billede_sti is not null), 0,
  'Slet konto clears the pictures of the login''s Medlemmer');

-- ---------- Slet Bødekasse ----------
delete from public.billede_oprydning;
select tests.log_ind_som_medlem(:'bo');
select public.slet_bodekasse(gen_random_uuid(), :'b', 'Kasse B');
select tests.log_ud();
select results_eq('select * from tests.i_koe()',
  format($$ select unnest(array[%L, %L, %L]) order by 1 $$, :'mit_b', :'mit_b_uden', :'bos'),
  'Slet Bødekasse queues every file in the box');

-- ---------- The hourly run wakes ryd-billeder ----------
-- The three paths of Kasse B wait in the outbox.
create function tests.vaekninger() returns int language sql as $$
  select count(*)::int from net.http_request_queue where url = 'https://fn.example/ryd-billeder'
$$;
select private.koer_automatik(now());
select is(tests.vaekninger(), 0,
  'with no sender configured, the hourly run wakes nothing (and doesn''t fail)');

select vault.create_secret('https://fn.example/ryd-billeder', 'ryd_billeder_url');
select vault.create_secret('hemmelig', 'ryd_billeder_secret');
select private.koer_automatik(now());
select is(tests.vaekninger(), 1, 'once configured, the hourly run wakes ryd-billeder');
select is((select headers ->> 'Authorization' from net.http_request_queue
            where url = 'https://fn.example/ryd-billeder' limit 1), 'Bearer hemmelig',
  'it authenticates with the shared secret');

-- ---------- The sender's claim and marker ----------
select tests.log_ind_som_medlem(:'anna');
select throws_ok('select public.billede_oprydning_hent_klar(10)', '42501', null,
  'a logged-in Medlem can''t claim deletions');
select tests.log_ud();

select private.koer_automatik(now());   -- a second run before the sender got to it
set local role service_role;
select results_eq(
  $$ select x ->> 'sti' from jsonb_array_elements(public.billede_oprydning_hent_klar(10)) x order by 1 $$,
  format($$ select unnest(array[%L, %L, %L]) order by 1 $$, :'mit_b', :'mit_b_uden', :'bos'),
  'the sender claims every due path, once, however often it was woken');
select is(public.billede_oprydning_hent_klar(10), '[]'::jsonb,
  'a claimed path is not handed out twice');
reset role;

select id as bos_id from public.billede_oprydning where sti = :'bos' \gset
set local role service_role;
select public.billede_oprydning_marker(array(
  select id from public.billede_oprydning where sti in (:'mit_b', :'mit_b_uden')), null);
select public.billede_oprydning_marker(array[:'bos_id'::bigint], 'netværksfejl');
reset role;
select results_eq('select * from tests.i_koe()', format($$ values (%L) $$, :'bos'),
  'deleted paths are done; a failed one waits for a retry');

-- The claim expires after 5 minutes; then only the failed path comes back.
update public.billede_oprydning set paabegyndt = now() - interval '6 minutes'
 where slettet is null and paabegyndt is not null;
set local role service_role;
select results_eq(
  $$ select x ->> 'sti' from jsonb_array_elements(public.billede_oprydning_hent_klar(10)) x $$,
  format($$ values (%L) $$, :'bos'),
  'after the claim expires, a failed path is retried and a deleted one never');
select public.billede_oprydning_marker(array[:'bos_id'::bigint], null);
reset role;

select private.koer_automatik(now());
select is(tests.vaekninger(), 2, 'with nothing due, the hourly run wakes nothing');

select * from finish();
rollback;
