-- Brug også i mine andre bødekasser (#103): copying your picture to your
-- Medlemmer in your other active Bødekasser. The client copies the file in
-- Storage (read your own picture, write into your own folder in the other
-- box); kopier_mit_billede then points those Medlemmer at their copies.
begin;
\ir _hjaelpere.psql
select plan(21);

select tests.opret_bodekasse('Kasse A') as a \gset
select tests.opret_bodekasse('Kasse B') as b \gset
select tests.opret_bodekasse('Kasse C') as c \gset
select tests.opret_bodekasse('Kasse D') as d \gset
select tests.opret_bodekasse('Kasse E') as e \gset
select tests.opret_bruger('mads@test.dk') as mads \gset
select tests.opret_medlem(:'a', 'Mads', null, false, :'mads') as mads_a \gset
select tests.opret_medlem(:'b', 'Mads R.', null, false, :'mads') as mads_b \gset
select tests.opret_medlem(:'c', 'Mads', null, false, :'mads') as mads_c \gset
select tests.opret_medlem(:'e', 'Mads', null, false, :'mads') as mads_e \gset
update public.medlem set udmeldt = now() where id = :'mads_c';
select tests.opret_medlem_med_login(:'b', 'Bo') as bo \gset
select tests.opret_medlem_med_login(:'d', 'Dorte') as dorte \gset

select format('%s/%s/kilde.webp', :'a', :'mads_a') as kilde \gset
select format('%s/%s/gammel.webp', :'b', :'mads_b') as b_gammel \gset
select format('%s/%s/kopi.webp', :'b', :'mads_b') as b_kopi \gset
select format('%s/%s/kopi2.webp', :'b', :'mads_b') as b_kopi2 \gset
select format('%s/%s/kopi.webp', :'e', :'mads_e') as e_kopi \gset
select format('%s/%s/kopi.webp', :'a', :'mads_a') as a_kopi \gset
select format('%s/%s/kopi.webp', :'c', :'mads_c') as c_kopi \gset
select format('%s/%s/kopi.webp', :'b', :'bo') as bo_kopi \gset
select format('%s/%s/kopi.webp', :'d', :'dorte') as d_kopi \gset

-- Files that already exist (as the Storage API would have written them).
insert into storage.objects (bucket_id, name)
values ('profilbilleder', :'kilde'), ('profilbilleder', :'b_gammel'), ('profilbilleder', :'b_kopi2'),
       ('profilbilleder', :'a_kopi'), ('profilbilleder', :'c_kopi'), ('profilbilleder', :'bo_kopi'),
       ('profilbilleder', :'d_kopi');
update public.medlem set billede_sti = :'kilde' where id = :'mads_a';
update public.medlem set billede_sti = :'b_gammel' where id = :'mads_b';

-- ---------- The Storage copy is allowed only into your own active folders ----------

select tests.log_ind_som(:'mads');
select isnt_empty(format($$ select 1 from storage.objects where name = %L $$, :'kilde'),
  'you can read your own picture, the source of the copy');
select lives_ok(
  format($$ insert into storage.objects (bucket_id, name) values ('profilbilleder', %L) $$, :'b_kopi'),
  'you can write the copy into your own Medlem''s folder in another Bødekasse');
select lives_ok(
  format($$ insert into storage.objects (bucket_id, name) values ('profilbilleder', %L) $$, :'e_kopi'),
  'and into your folder in each of your other Bødekasser');
select throws_ok(
  format($$ insert into storage.objects (bucket_id, name) values ('profilbilleder', '%s/%s/x.webp') $$,
         :'c', :'mads_c'),
  '42501', null, 'you cannot write a copy into a Bødekasse you are Udmeldt from');
select throws_ok(
  format($$ insert into storage.objects (bucket_id, name) values ('profilbilleder', '%s/%s/x.webp') $$,
         :'b', :'bo'),
  '42501', null, 'you cannot write a copy into another Medlem''s folder');

-- ---------- Copying ----------

select is(public.kopier_mit_billede(gen_random_uuid(), :'a', array[:'b_kopi', :'e_kopi']),
  jsonb_build_object('billede_stier', jsonb_build_array(:'b_kopi', :'e_kopi')),
  'copying returns the new paths');
select is((select billede_sti from public.medlem where id = :'mads_b'), :'b_kopi',
  'your Medlem in another Bødekasse now shows its own copy');
select is((select billede_sti from public.medlem where id = :'mads_e'), :'e_kopi',
  'every Medlem you copied to gets its copy');
select is((select billede_sti from public.medlem where id = :'mads_a'), :'kilde',
  'the source Medlem keeps its picture');

select tests.log_ud();
select results_eq(
  $$ select sti from public.billede_oprydning where slettet is null $$,
  format($$ values (%L) $$, :'b_gammel'),
  'the replaced picture is queued for cleanup, and the source is not');

-- ---------- Only your own other active Medlemmer ----------

select tests.log_ind_som(:'mads');
select throws_ok(
  format($$ select public.kopier_mit_billede(gen_random_uuid(), %L, array[%L]) $$, :'a', :'bo_kopi'),
  'P0001', 'billede_sti_ugyldig', 'you cannot copy into another Medlem''s folder');
select throws_ok(
  format($$ select public.kopier_mit_billede(gen_random_uuid(), %L, array[%L]) $$, :'a', :'d_kopi'),
  'P0001', 'billede_sti_ugyldig', 'you cannot copy into a Bødekasse you are not in');
select throws_ok(
  format($$ select public.kopier_mit_billede(gen_random_uuid(), %L, array[%L]) $$, :'a', :'c_kopi'),
  'P0001', 'billede_sti_ugyldig', 'you cannot copy to your Medlem in a Bødekasse you are Udmeldt from');
select throws_ok(
  format($$ select public.kopier_mit_billede(gen_random_uuid(), %L, array[%L]) $$, :'a', :'a_kopi'),
  'P0001', 'billede_sti_ugyldig', 'you can only copy to your other Bødekasser, not the source');
select throws_ok(
  format($$ select public.kopier_mit_billede(gen_random_uuid(), %L, array[%L, %L]) $$,
         :'a', :'b_kopi', :'b_kopi2'),
  'P0001', 'billede_sti_ugyldig', 'you cannot give one Medlem two copies in one call');
select throws_ok(
  format($$ select public.kopier_mit_billede(gen_random_uuid(), %L, array['%s/%s/../%s/kopi.webp']) $$,
         :'a', :'b', :'mads_b', :'bo'),
  'P0001', 'billede_sti_ugyldig', 'a path cannot climb out of your folder');
select throws_ok(
  format($$ select public.kopier_mit_billede(gen_random_uuid(), %L, array['%s/%s/findes-ikke.webp']) $$,
         :'a', :'b', :'mads_b'),
  'P0001', 'billede_findes_ikke', 'the copy must exist in Storage before you set it');

select throws_ok(
  format($$ select public.kopier_mit_billede(gen_random_uuid(), %L, array[%L, %L]) $$,
         :'a', :'b_kopi2', :'bo_kopi'),
  'P0001', 'billede_sti_ugyldig', 'one bad path rejects the whole copy');
select is((select billede_sti from public.medlem where id = :'mads_b'), :'b_kopi',
  'so a rejected copy changes nothing');

select throws_ok(
  format($$ select public.kopier_mit_billede(gen_random_uuid(), %L, array[%L]) $$, :'c', :'b_kopi2'),
  '42501', 'ikke_medlem', 'you cannot copy from a Bødekasse you are Udmeldt from');

select public.fjern_mit_billede(gen_random_uuid(), :'a');
select throws_ok(
  format($$ select public.kopier_mit_billede(gen_random_uuid(), %L, array[%L]) $$, :'a', :'b_kopi2'),
  'P0001', 'intet_billede', 'you can only copy when you have a picture in the source Bødekasse');

select * from finish();
rollback;
