-- udmeld / genoptag: an Admin makes a Medlem Udmeldt (also while they owe)
-- and brings them back to the same spot. Udmeldt loses read access.
begin;
\ir _hjaelpere.psql
select plan(19);

select tests.opret_bodekasse('Kasse A') as a \gset
select tests.opret_medlem_med_login(:'a', 'Mads', true) as mads \gset
select tests.opret_medlem_med_login(:'a', 'Frederik', true) as frederik \gset
select tests.opret_medlem_med_login(:'a', 'Jonas') as jonas \gset
select tests.giv_bode(:'mads', :'jonas', 40) as bode \gset
select gen_random_uuid() as id1 \gset

-- Before: Jonas sees the box.
select tests.log_ind_som_medlem(:'jonas');
select isnt_empty(format($$ select 1 from public.bodekasse where id = %L $$, :'a'), 'Jonas sees the box before');

-- Meld ud works while Jonas owes 40 kr.
select tests.log_ind_som_medlem(:'mads');
select is(public.udmeld(:'id1', :'a', :'jonas'), '{}'::jsonb, 'an Admin melder a Medlem ud, unpaid Saldo and all');
select isnt((select udmeldt from public.medlem where id = :'jonas'), null, 'Jonas is Udmeldt');
select is(public.udmeld(:'id1', :'a', :'jonas'), '{}'::jsonb, 'a retry with the same one-time ID is ignored');
select is((select saldo from public.medlem_saldo where medlem_id = :'jonas')::int, 40,
  'the Udmeldt keeps their Saldo');
select results_eq(
  format($$ select art, aktoer_id, modtager_id, ref_tabel, ref_id, data->>'navn' from public.haendelse
             where bodekasse_id = %L and art like 'medlem_%%' $$, :'a'),
  format($$ values ('medlem_udmeldt'::text, %L::uuid, %L::uuid, 'medlem'::text, %L::uuid, 'Jonas'::text) $$,
         :'mads', :'jonas', :'jonas'),
  'Meld ud adds one feed entry about the Medlem');
select throws_ok(format($$ select public.udmeld(gen_random_uuid(), %L, %L) $$, :'a', :'jonas'),
  'P0001', 'medlem_udmeldt', 'an Udmeldt can''t be meldt ud again');

-- Udmeldt loses read access to the box.
select tests.log_ind_som_medlem(:'jonas');
select is_empty(format($$ select 1 from public.bodekasse where id = %L $$, :'a'), 'the Udmeldt no longer sees the box');
select is_empty(format($$ select 1 from public.medlem where bodekasse_id = %L $$, :'a'), 'nor its Medlemmer');
select is_empty(format($$ select 1 from public.bode where bodekasse_id = %L $$, :'a'), 'nor its Bøder');
select throws_ok(format($$ select public.ret_mit_navn(gen_random_uuid(), %L, 'X') $$, :'a'),
  '42501', 'ikke_medlem', 'and can''t act in it');

-- An Admin can't meld themself ud; a plain Medlem can't meld anyone ud.
select tests.log_ind_som_medlem(:'mads');
select throws_ok(format($$ select public.udmeld(gen_random_uuid(), %L, %L) $$, :'a', :'mads'),
  'P0001', 'melder_dig_selv_ud', 'nobody melder themself ud');
select tests.log_ind_som_medlem(:'frederik');
select public.saet_admin(gen_random_uuid(), :'a', :'frederik', false);
select throws_ok(format($$ select public.udmeld(gen_random_uuid(), %L, %L) $$, :'a', :'mads'),
  '42501', 'ikke_admin', 'a plain Medlem can''t meld anyone ud');

-- Meld ud drops the Admin role.
select tests.log_ind_som_medlem(:'mads');
select public.saet_admin(gen_random_uuid(), :'a', :'frederik', true);
select public.udmeld(gen_random_uuid(), :'a', :'frederik');
select ok(not (select er_admin from public.medlem where id = :'frederik'), 'an Udmeldt Admin loses the role');

-- Genoptag: same spot, full history, access back.
select throws_ok(format($$ select public.genoptag(gen_random_uuid(), %L, %L) $$, :'a', :'mads'),
  'P0001', 'medlem_ikke_udmeldt', 'only an Udmeldt can be genoptaget');
select is(public.genoptag(gen_random_uuid(), :'a', :'jonas'), '{}'::jsonb, 'an Admin genoptager an Udmeldt');
select results_eq(
  format($$ select art, modtager_id from public.haendelse
             where bodekasse_id = %L and art = 'medlem_genoptaget' $$, :'a'),
  format($$ values ('medlem_genoptaget'::text, %L::uuid) $$, :'jonas'),
  'Genoptag adds a feed entry about the Medlem');
select tests.log_ind_som_medlem(:'jonas');
select results_eq(format($$ select id from public.bode where bodekasse_id = %L $$, :'a'),
  format($$ values (%L::uuid) $$, :'bode'), 'back in, Jonas sees the box and his old Bøde');
select is((select saldo from public.medlem_saldo where medlem_id = :'jonas')::int, 40,
  'and still owes the same');

select * from finish();
rollback;
