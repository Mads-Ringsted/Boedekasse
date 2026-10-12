-- Reads go through RLS; writes only through RPCs. This guards every table and
-- view in `public`, including the ones later tickets add.
begin;
\ir _hjaelpere.psql
select plan(6);

select is_empty($$
  select c.relname from pg_class c
   where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p')
     and not c.relrowsecurity
$$, 'every table in public has row level security on');

select is_empty($$
  select table_name, privilege_type from information_schema.role_table_grants
   where table_schema = 'public' and grantee = 'anon'
$$, 'anon has no privilege on any table or view');

select is_empty($$
  select table_name, privilege_type from information_schema.role_table_grants
   where table_schema = 'public' and grantee = 'authenticated'
     and privilege_type <> 'SELECT'
$$, 'authenticated can only select: no insert, update or delete on any table or view');

select is_empty($$
  select p.oid::regprocedure from pg_proc p
   where p.pronamespace in ('public'::regnamespace, 'private'::regnamespace)
     and (has_function_privilege('anon', p.oid, 'execute')
          or exists (select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                      where a.grantee = 0 and a.privilege_type = 'EXECUTE'))
$$, 'no function in public or private is executable by anon or public');

select is_empty($$
  select c.relname from pg_class c
   where c.relnamespace = 'public'::regnamespace and c.relkind = 'v'
     and not coalesce('security_invoker=true' = any (c.reloptions), false)
$$, 'every view in public runs with the caller''s rights (security_invoker)');

-- A new box row in a Medlem's own box is still refused (no grant).
select tests.opret_bodekasse() as kasse \gset
select tests.opret_medlem_med_login(:'kasse', 'Anna', true) as anna \gset
select tests.log_ind_som_medlem(:'anna');
select throws_ok(
  format($$ update public.bodekasse set navn = 'Hacket' where id = %L $$, :'kasse'),
  '42501', null,
  'even an Admin cannot write a table directly');

select * from finish();
rollback;
