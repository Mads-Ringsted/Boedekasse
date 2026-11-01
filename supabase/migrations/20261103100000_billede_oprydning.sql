-- Profilbillede cleanup (spec #99, ticket #104): picture files are deleted
-- from Storage when nothing needs them any more.
--
-- How a file travels:
--   1. When a picture stops being needed, its Storage path goes into the
--      cleanup outbox public.billede_oprydning, in the same transaction:
--        set / replace / remove   the old path (private.skift_billede)
--        Slet medlem              every file in that Medlem's folder
--        Slet Bødekasse           every file in the box (its Medlemmer go)
--        Slet konto               every file of the login's Medlemmer, and
--                                 their pictures are cleared
--      Udmeldt keeps the picture: nothing is queued.
--   2. The hourly automation run (private.koer_automatik) ends with
--      private.skub_billede_oprydning(). When rows are due and the sender is
--      configured in Vault, it asks the Edge Function ryd-billeder (supabase/
--      functions/ryd-billeder) to run, via pg_net. Fail-soft, like push.
--   3. ryd-billeder claims due rows (billede_oprydning_hent_klar), deletes the
--      files through the Storage API and marks the rows done
--      (billede_oprydning_marker). A path already gone counts as deleted.
--      Those two RPCs are service_role only.
--
-- SQL can't delete the files itself: a row in storage.objects is only the
-- index of a file, and Storage protects it from direct deletes.
--
-- Additive only: a table, functions, triggers on medlem. Redefines
-- private.skift_billede (#100) and private.koer_automatik (#78).

-- ---------- The outbox ----------
-- One row = one Storage path in the profilbilleder bucket to delete.
--   paabegyndt  claimed by a sender run; a claim older than 5 minutes is retried
--   forsoeg     how many runs claimed it; after 10 the row is given up
--   slettet     the file is gone (done)
--   fejl        the last error, while the row waits for a retry
-- No foreign keys: a row must outlive the Medlem and box it came from.
create table public.billede_oprydning (
  id          bigint generated always as identity primary key,
  sti         text not null check (btrim(sti) <> ''),
  oprettet    timestamptz not null default now(),
  paabegyndt  timestamptz,
  forsoeg     int not null default 0,
  slettet     timestamptz,
  fejl        text
);
-- A path waits in the outbox at most once.
create unique index billede_oprydning_ventende_idx on public.billede_oprydning (sti)
  where slettet is null;
alter table public.billede_oprydning enable row level security;
-- No policy: only the database and the sender touch the outbox.

-- Queues one path (null does nothing; a path already waiting stays one row).
create function private.ryd_billede(p_sti text) returns void
language sql volatile security definer set search_path = '' as $$
  insert into public.billede_oprydning (sti)
  select p_sti where p_sti is not null
  on conflict (sti) where slettet is null do nothing
$$;

revoke execute on function private.ryd_billede(text) from public, anon, authenticated;

-- ---------- Set, replace, remove ----------
-- From 20261103000000_profilbilleder.sql, plus: the old path is queued when
-- the picture changes.
create or replace function private.skift_billede(p_medlem uuid, p_sti text) returns text
language plpgsql volatile security definer set search_path = '' as $$
declare v_gammel text;
begin
  select billede_sti into v_gammel from public.medlem where id = p_medlem for update;
  update public.medlem set billede_sti = p_sti where id = p_medlem;
  if v_gammel is distinct from p_sti then
    perform private.ryd_billede(v_gammel);
  end if;
  return v_gammel;
end $$;

-- ---------- Slet medlem, Slet Bødekasse, Slet konto ----------
-- Triggers on medlem rather than changes to the three RPCs: a Medlem goes
-- away (Slet medlem, or Slet Bødekasse's cascade) or loses its login (Slet
-- konto, or a login deleted any other way) in exactly these two places.

-- Queues a Medlem's picture and every file in its folder, including files
-- uploaded but never set as the picture.
create function private.ryd_billedmappe(p_bodekasse uuid, p_medlem uuid, p_sti text)
returns void
language sql volatile security definer set search_path = '' as $$
  select private.ryd_billede(p_sti);
  select private.ryd_billede(o.name)
    from storage.objects o
   where o.bucket_id = 'profilbilleder'
     and o.name like p_bodekasse::text || '/' || p_medlem::text || '/%'
   order by o.name;
$$;

revoke execute on function private.ryd_billedmappe(uuid, uuid, text) from public, anon, authenticated;

create function private.ryd_billeder_slettet_medlem() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.ryd_billedmappe(old.bodekasse_id, old.id, old.billede_sti);
  return null;
end $$;

create trigger ryd_billeder after delete on public.medlem
  for each row execute function private.ryd_billeder_slettet_medlem();

-- The spot stays (see medlem_konto_slettet), the picture goes.
create function private.ryd_billeder_slettet_konto() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.ryd_billedmappe(old.bodekasse_id, old.id, old.billede_sti);
  new.billede_sti := null;
  return new;
end $$;

create trigger medlem_konto_slettet_billede
  before update of user_id on public.medlem
  for each row when (old.user_id is not null and new.user_id is null)
  execute function private.ryd_billeder_slettet_konto();

-- ---------- Waking the sender ----------

-- A path is due when not deleted, claimed by no run in the last 5 minutes and
-- tried fewer than 10 times.
create function private.billede_oprydning_klar(p_raekke public.billede_oprydning)
returns boolean
language sql stable set search_path = '' as $$
  select p_raekke.slettet is null and p_raekke.forsoeg < 10
     and (p_raekke.paabegyndt is null or p_raekke.paabegyndt < now() - interval '5 minutes')
$$;

-- Asks the Edge Function to delete, when paths are due and the owner has
-- configured it in Vault (secrets 'ryd_billeder_url' and 'ryd_billeder_secret',
-- see docs/ops/billede-oprydning-setup.md). Otherwise, or on any error, it
-- does nothing: the hourly run must never fail because of cleanup.
create function private.skub_billede_oprydning() returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_url         text;
  v_hemmelighed text;
begin
  if not exists (select 1 from public.billede_oprydning o
                  where private.billede_oprydning_klar(o)) then
    return;
  end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'ryd_billeder_url';
  select decrypted_secret into v_hemmelighed from vault.decrypted_secrets where name = 'ryd_billeder_secret';
  if coalesce(v_url, '') = '' or coalesce(v_hemmelighed, '') = '' then
    return;
  end if;
  -- pg_net sends after commit, so the function sees the new rows.
  perform net.http_post(
    url := v_url,
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'Authorization', 'Bearer ' || v_hemmelighed),
    timeout_milliseconds := 10000);
exception when others then
  raise warning 'skub_billede_oprydning: %', sqlerrm;
end $$;

revoke execute on function private.skub_billede_oprydning() from public, anon, authenticated;

-- ---------- koer_automatik (from 20261101170100_automatik_catch_up.sql) ----------
-- Unchanged, plus: after every box's steps, wake the picture cleanup once.
-- (Not a step: steps run per box, and the cleanup belongs to no box. A
-- deleted box's files must still go when no box is left.)
create or replace function private.koer_automatik(p_nu timestamptz) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_kasse public.bodekasse;
  v_trin  private.automatik_trin;
  v_dato  date;
begin
  for v_kasse in select * from public.bodekasse order by id loop
    v_dato := private.lokal_dato(p_nu);   -- every box keeps Copenhagen time
    for v_trin in select * from private.automatik_trin order by raekkefoelge, navn loop
      begin
        execute format('select %s($1, $2, $3)', v_trin.funktion) using v_kasse, p_nu, v_dato;
      exception when others then
        raise warning 'koer_automatik: step % failed for box %: % (%)',
          v_trin.navn, v_kasse.id, sqlerrm, sqlstate;
      end;
    end loop;
  end loop;
  perform private.skub_billede_oprydning();
end $$;

-- ---------- RPCs for the sender (service_role only) ----------

-- Claims up to p_max due paths and returns them as [{id, sti}], oldest first.
-- Concurrent runs never get the same row.
create function public.billede_oprydning_hent_klar(p_max int default 100)
returns jsonb
language sql volatile security definer set search_path = '' as $$
  with klar as (
    select o.id from public.billede_oprydning o
     where private.billede_oprydning_klar(o)
     order by o.id
     limit greatest(coalesce(p_max, 100), 1)
       for update skip locked
  ), taget as (
    update public.billede_oprydning u
       set paabegyndt = now(), forsoeg = u.forsoeg + 1
      from klar where u.id = klar.id
    returning u.id, u.sti
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'sti', t.sti) order by t.id), '[]'::jsonb)
    from taget t
$$;

-- Marks claimed rows: deleted when p_fejl is null (a path already gone counts
-- as deleted), else keeps the error and leaves the row for a retry once its
-- claim expires. A row already deleted is left alone.
create function public.billede_oprydning_marker(p_ids bigint[], p_fejl text default null)
returns void
language sql volatile security definer set search_path = '' as $$
  update public.billede_oprydning
     set slettet = case when p_fejl is null then now() end,
         fejl    = p_fejl
   where id = any(p_ids) and slettet is null
$$;

revoke execute on function public.billede_oprydning_hent_klar(int) from public, anon, authenticated;
revoke execute on function public.billede_oprydning_marker(bigint[], text) from public, anon, authenticated;
grant execute on function public.billede_oprydning_hent_klar(int) to service_role;
grant execute on function public.billede_oprydning_marker(bigint[], text) to service_role;
