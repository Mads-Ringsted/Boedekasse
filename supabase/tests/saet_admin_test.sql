-- saet_admin: any Admin gives or takes the Admin role, their own included.
-- The last Admin can't drop it. No feed entry for role changes.
begin;
\ir _hjaelpere.psql
select plan(10);

select tests.opret_bodekasse('Kasse A') as a \gset
select tests.opret_bodekasse('Kasse B') as b \gset
select tests.opret_medlem_med_login(:'a', 'Mads', true) as mads \gset
select tests.opret_medlem_med_login(:'a', 'Anna') as anna \gset
select tests.opret_medlem(:'a', 'Sebastian', 'sebastian@test.dk') as sebastian \gset
select tests.opret_medlem_med_login(:'b', 'Bo', true) as bo \gset
select gen_random_uuid() as id1 \gset

-- The only Admin can't drop the role.
select tests.log_ind_som_medlem(:'mads');
select throws_ok(format($$ select public.saet_admin(gen_random_uuid(), %L, %L, false) $$, :'a', :'mads'),
  'P0001', 'sidste_admin', 'the last Admin can''t drop the role');

-- An Admin makes another Medlem Admin (a not-logged-in one works too).
select is(public.saet_admin(:'id1', :'a', :'anna', true), jsonb_build_object('er_admin', true),
  'an Admin makes a Medlem Admin');
select ok((select er_admin from public.medlem where id = :'anna'), 'Anna is now Admin');
select is(public.saet_admin(:'id1', :'a', :'anna', true), jsonb_build_object('er_admin', true),
  'a retry with the same one-time ID returns the first answer');

-- With two Admins, one can drop their own role.
select public.saet_admin(gen_random_uuid(), :'a', :'mads', false);
select ok(not (select er_admin from public.medlem where id = :'mads'), 'an Admin can drop their own role');

-- Now Mads is a plain Medlem.
select throws_ok(format($$ select public.saet_admin(gen_random_uuid(), %L, %L, true) $$, :'a', :'sebastian'),
  '42501', 'ikke_admin', 'a plain Medlem can''t change roles');

-- Anna (the only Admin now) removes Mads? He has no role; dropping hers fails.
select tests.log_ind_som_medlem(:'anna');
select throws_ok(format($$ select public.saet_admin(gen_random_uuid(), %L, %L, false) $$, :'a', :'anna'),
  'P0001', 'sidste_admin', 'the new last Admin can''t drop it either');

-- Another box's Medlem can't be targeted.
select throws_ok(format($$ select public.saet_admin(gen_random_uuid(), %L, %L, true) $$, :'a', :'bo'),
  'P0001', 'medlem_ukendt', 'a Medlem of another box is unknown here');

-- An Udmeldt Medlem's role can't change.
select tests.log_ud();
update public.medlem set udmeldt = now() where id = :'sebastian';
select tests.log_ind_som_medlem(:'anna');
select throws_ok(format($$ select public.saet_admin(gen_random_uuid(), %L, %L, true) $$, :'a', :'sebastian'),
  'P0001', 'medlem_udmeldt', 'an Udmeldt Medlem''s role can''t change');

select is_empty(format($$ select 1 from public.haendelse where bodekasse_id = %L $$, :'a'),
  'role changes make no feed entry');

select * from finish();
rollback;
