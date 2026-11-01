-- Profilbillede (#100): the private bucket's access rules, and setting and
-- removing your own picture. Paths are <bodekasse>/<medlem>/<file>.
begin;
\ir _hjaelpere.psql
select plan(29);

select tests.opret_bodekasse('Kasse A') as a \gset
select tests.opret_bodekasse('Kasse B') as b \gset
select tests.opret_bruger('mads@test.dk') as mads \gset
select tests.opret_medlem(:'a', 'Mads', null, false, :'mads') as mads_a \gset
select tests.opret_medlem(:'b', 'Mads R.', null, false, :'mads') as mads_b \gset
select tests.opret_medlem_med_login(:'a', 'Anna') as anna \gset
select tests.opret_medlem_med_login(:'b', 'Bo') as bo \gset
select tests.opret_medlem_med_login(:'a', 'Ulla') as ulla \gset
update public.medlem set udmeldt = now() where id = :'ulla';

select format('%s/%s/1.webp', :'a', :'mads_a') as mit1 \gset
select format('%s/%s/2.webp', :'a', :'mads_a') as mit2 \gset
select format('%s/%s/1.webp', :'a', :'anna') as annas \gset
select format('%s/%s/1.webp', :'b', :'mads_a') as forkert_kasse \gset

-- Uploaded files (as the Storage API would write them).
insert into storage.objects (bucket_id, name)
values ('profilbilleder', :'mit1'), ('profilbilleder', :'mit2'), ('profilbilleder', :'annas'),
       ('profilbilleder', :'forkert_kasse');

select is((select public from storage.buckets where id = 'profilbilleder'), false,
  'the profilbilleder bucket is private');
select is((select billede_sti from public.medlem where id = :'mads_a'), null,
  'a Medlem starts without a picture');

-- ---------- Reading files ----------

select tests.log_ind_som_medlem(:'anna');
select results_eq(
  $$ select name from storage.objects where bucket_id = 'profilbilleder' order by name $$,
  format($$ select unnest(array[%L, %L, %L]) order by 1 $$, :'mit1', :'mit2', :'annas'),
  'a Medlem can read every picture file in their own Bødekasse, and none in others');

select tests.log_ind_som_medlem(:'bo');
select results_eq(
  $$ select name from storage.objects where bucket_id = 'profilbilleder' $$,
  format($$ values (%L) $$, :'forkert_kasse'),
  'another Bødekasse cannot read the pictures of Kasse A');

select tests.log_ind_som_medlem(:'ulla');
select is_empty($$ select 1 from storage.objects where bucket_id = 'profilbilleder' $$,
  'an Udmeldt Medlem can no longer read the pictures');

select tests.log_ind_som(tests.opret_bruger('fremmed@test.dk'));
select is_empty($$ select 1 from storage.objects where bucket_id = 'profilbilleder' $$,
  'a login with no Medlem reads no pictures');

select tests.log_ind_som_anon();
select is_empty($$ select 1 from storage.objects where bucket_id = 'profilbilleder' $$,
  'an anonymous visitor reads no pictures');

-- ---------- Uploading files ----------

select tests.log_ind_som(:'mads');
select lives_ok(
  format($$ insert into storage.objects (bucket_id, name) values ('profilbilleder', '%s/%s/3.webp') $$,
         :'a', :'mads_a'),
  'you can upload into your own Medlem''s folder');
select lives_ok(
  format($$ insert into storage.objects (bucket_id, name) values ('profilbilleder', '%s/%s/1.webp') $$,
         :'b', :'mads_b'),
  'you can upload into your own folder in each of your Bødekasser');
select throws_ok(
  format($$ insert into storage.objects (bucket_id, name) values ('profilbilleder', '%s/%s/9.webp') $$,
         :'a', :'anna'),
  '42501', null, 'you cannot upload into another Medlem''s folder');
select throws_ok(
  format($$ insert into storage.objects (bucket_id, name) values ('profilbilleder', '%s/%s/9.webp') $$,
         :'a', :'mads_b'),
  '42501', null, 'you cannot upload into your folder name under another Bødekasse');
select throws_ok(
  format($$ insert into storage.objects (bucket_id, name) values ('profilbilleder', '%s/%s/x/9.webp') $$,
         :'a', :'mads_a'),
  '42501', null, 'you cannot upload into a subfolder of your folder');

select tests.log_ind_som_medlem(:'ulla');
select throws_ok(
  format($$ insert into storage.objects (bucket_id, name) values ('profilbilleder', '%s/%s/1.webp') $$,
         :'a', :'ulla'),
  '42501', null, 'an Udmeldt Medlem cannot upload');

-- ---------- Deleting files ----------

select set_config('storage.allow_delete_query', 'true', true);
select tests.log_ind_som_medlem(:'anna');
delete from storage.objects where bucket_id = 'profilbilleder' and name = :'mit1';
select tests.log_ud();
select isnt_empty(format($$ select 1 from storage.objects where name = %L $$, :'mit1'),
  'you cannot delete another Medlem''s picture file');

select tests.log_ind_som(:'mads');
delete from storage.objects where bucket_id = 'profilbilleder' and name = :'a' || '/' || :'mads_a' || '/3.webp';
select tests.log_ud();
select is_empty(format($$ select 1 from storage.objects where name = '%s/%s/3.webp' $$, :'a', :'mads_a'),
  'you can delete your own picture file');

-- ---------- Setting your picture ----------

select tests.log_ind_som(:'mads');
select is(public.saet_mit_billede(gen_random_uuid(), :'a', :'mit1'),
  jsonb_build_object('billede_sti', :'mit1'),
  'setting your picture returns the new path');
select is((select billede_sti from public.medlem where id = :'mads_a'), :'mit1',
  'the path is stored on your Medlem');
select is((select billede_sti from public.medlem where id = :'mads_b'), null,
  'your Medlem in another Bødekasse keeps its own picture');

select tests.log_ind_som_medlem(:'anna');
select is((select billede_sti from public.medlem where id = :'mads_a'), :'mit1',
  'the other Medlemmer see the path');

select tests.log_ind_som(:'mads');
select public.saet_mit_billede(gen_random_uuid(), :'a', :'mit2');
select is((select billede_sti from public.medlem where id = :'mads_a'), :'mit2',
  'a new picture replaces the old one');

select throws_ok(format($$ select public.saet_mit_billede(gen_random_uuid(), %L, %L) $$, :'a', :'annas'),
  'P0001', 'billede_sti_ugyldig', 'you cannot set a path in another Medlem''s folder');
select throws_ok(format($$ select public.saet_mit_billede(gen_random_uuid(), %L, %L) $$, :'a', :'forkert_kasse'),
  'P0001', 'billede_sti_ugyldig', 'you cannot set a path under another Bødekasse');
select throws_ok(
  format($$ select public.saet_mit_billede(gen_random_uuid(), %L, '%s/%s/../%s/1.webp') $$,
         :'a', :'a', :'mads_a', :'anna'),
  'P0001', 'billede_sti_ugyldig', 'a path cannot climb out of your folder');
select throws_ok(
  format($$ select public.saet_mit_billede(gen_random_uuid(), %L, '%s/%s/findes-ikke.webp') $$,
         :'a', :'a', :'mads_a'),
  'P0001', 'billede_findes_ikke', 'the file must be uploaded before you set it');

-- ---------- Removing your picture ----------

select is(public.fjern_mit_billede(gen_random_uuid(), :'a'), jsonb_build_object('billede_sti', null),
  'removing your picture returns no path');
select is((select billede_sti from public.medlem where id = :'mads_a'), null,
  'the path is cleared, so initials show again');

-- ---------- Only your own active Medlem ----------

select tests.log_ind_som_medlem(:'ulla');
select throws_ok(
  format($$ select public.saet_mit_billede(gen_random_uuid(), %L, '%s/%s/1.webp') $$, :'a', :'a', :'ulla'),
  '42501', 'ikke_medlem', 'an Udmeldt Medlem cannot set a picture');
select throws_ok(format($$ select public.fjern_mit_billede(gen_random_uuid(), %L) $$, :'a'),
  '42501', 'ikke_medlem', 'an Udmeldt Medlem cannot remove a picture');

select tests.log_ind_som_medlem(:'bo');
select throws_ok(
  format($$ select public.saet_mit_billede(gen_random_uuid(), %L, %L) $$, :'a', :'mit1'),
  '42501', 'ikke_medlem', 'you cannot set a picture in a box you are not in');

select * from finish();
rollback;
