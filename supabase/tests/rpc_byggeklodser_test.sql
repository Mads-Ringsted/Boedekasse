-- The shared building blocks every write RPC uses: resolve the caller's
-- Medlem (reject Udmeldt / non-Medlem / non-Admin), ignore a repeat of the same
-- client-made one-time ID, and append a haendelse to the feed.
--
-- The pattern for a real RPC (copy it), shown with a throwaway test RPC:
begin;
\ir _hjaelpere.psql
select plan(10);

create function public.test_rpc(p_bodekasse uuid, p_klient_id uuid, p_kun_admin boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_mig       uuid;
  v_tidligere jsonb;
begin
  -- 1. who is calling (raises ikke_medlem / ikke_admin)
  v_mig := case when p_kun_admin then private.mit_admin(p_bodekasse)
                else private.mit_medlem(p_bodekasse) end;
  -- 4. a repeat with the same one-time ID returns the first answer, writes nothing
  v_tidligere := private.start_kald(p_klient_id, 'test_rpc');
  if v_tidligere is not null then return v_tidligere; end if;
  -- 2./3. check rules, write rows, append the feed entry
  perform private.tilfoej_haendelse(p_bodekasse, v_mig, 'test', jsonb_build_object('n', 1));
  return private.afslut_kald(p_klient_id, jsonb_build_object('ok', true));
end $$;
revoke execute on function public.test_rpc from public, anon;
grant execute on function public.test_rpc to authenticated;

select tests.opret_bodekasse('Kasse A') as kasse \gset
select tests.opret_bodekasse('Kasse B') as anden \gset
select tests.opret_medlem_med_login(:'kasse', 'Anna', true) as anna \gset
select tests.opret_medlem_med_login(:'kasse', 'Mikkel') as mikkel \gset
select tests.opret_medlem_med_login(:'kasse', 'Ulla') as ulla \gset
select tests.opret_medlem_med_login(:'anden', 'Bo') as bo \gset
update public.medlem set udmeldt = now() where id = :'ulla';
select private.seneste_saeson(:'kasse') as s1 \gset
select gen_random_uuid() as id1 \gset
select gen_random_uuid() as id2 \gset

select tests.log_ind_som_medlem(:'mikkel');
select is(public.test_rpc(:'kasse', :'id1'), '{"ok": true}'::jsonb,
  'a Medlem can call an RPC');
select results_eq(
  $$ select art, aktoer_id, saeson_id from public.haendelse $$,
  format($$ values ('test', %L::uuid, %L::uuid) $$, :'mikkel', :'s1'),
  'the RPC appends one feed entry by the caller in the latest Sæson');

select is(public.test_rpc(:'kasse', :'id1'), '{"ok": true}'::jsonb,
  'repeating the same one-time ID returns the first answer');
select is((select count(*) from public.haendelse), 1::bigint,
  'repeating the same one-time ID writes nothing more');

select public.test_rpc(:'kasse', :'id2');
select is((select count(*) from public.haendelse), 2::bigint,
  'a new one-time ID is a new call');

select throws_ok(format($$ select public.test_rpc(%L, gen_random_uuid(), true) $$, :'kasse'),
  '42501', 'ikke_admin', 'an Admin-only RPC rejects a plain Medlem');

select tests.log_ind_som_medlem(:'anna');
select is(public.test_rpc(:'kasse', gen_random_uuid(), true), '{"ok": true}'::jsonb,
  'an Admin-only RPC accepts an Admin');

select tests.log_ind_som_medlem(:'ulla');
select throws_ok(format($$ select public.test_rpc(%L, gen_random_uuid()) $$, :'kasse'),
  '42501', 'ikke_medlem', 'an Udmeldt Medlem is rejected');

select tests.log_ind_som_medlem(:'bo');
select throws_ok(format($$ select public.test_rpc(%L, gen_random_uuid()) $$, :'kasse'),
  '42501', 'ikke_medlem', 'a Medlem of another box is rejected');
select throws_ok(format($$ select public.test_rpc(%L, %L) $$, :'anden', :'id1'),
  'P0001', 'klient_id_brugt', 'someone else''s one-time ID is refused, not replayed');

select * from finish();
rollback;
