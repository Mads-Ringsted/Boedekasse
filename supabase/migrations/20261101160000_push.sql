-- #81 (spec #74 "Push"): Web Push opt-in and the first event, "Bøde modtaget".
--
-- Additive only: three tables, one enum, functions, two cron jobs and the
-- pg_net / pg_cron extensions. Nothing is sent until the owner configures the
-- sender (docs/ops/push-setup.md); until then every send hook is a no-op.
--
-- How a push travels:
--   1. An event calls private.push(login, art, bodekasse, titel, tekst, sti)
--      in its own transaction. It applies the login's preference and writes
--      one public.push_udbakke row (the outbox, and the test seam).
--   2. A statement trigger on the outbox, and a cron sweep every 30 seconds,
--      call private.skub_push(). When rows are due and the sender is
--      configured in Vault, it asks the Edge Function (supabase/functions/
--      send-push) to run, via pg_net.
--   3. The Edge Function claims due rows (push_hent_klar), sends them with
--      Web Push + VAPID to every subscription of the login, marks each row
--      sent or failed (push_marker) and deletes dead subscriptions on a 404
--      or 410 (push_fjern_abonnement). Those three RPCs are service_role only.
--
-- Later tickets (#82 Anke and payments, #83 reminders and automatic Gebyrer)
-- only call private.push(); everything after step 1 is shared.

create extension if not exists pg_net;
create extension if not exists pg_cron;

-- ---------- Types and tables ----------

-- One per kind of push; each is one toggle in Profil, on by default.
create type public.push_art as enum (
  'bode_modtaget',
  'anke_afstemning',
  'anke_resultat',
  'betalingsmelding_venter',
  'betaling_bekraeftet',
  'automatisk_gebyr',
  'betalingspaamindelse'
);

-- A device that allowed notifications (PushManager.subscribe). Keyed per
-- login, not per Medlem: one device gets the pushes of all the person's boxes.
-- An endpoint belongs to one login; subscribing it again moves it.
create table public.push_abonnement (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,
  endpoint   text not null unique check (endpoint ~ '^https://'),
  p256dh     text not null check (btrim(p256dh) <> ''),
  auth       text not null check (btrim(auth) <> ''),
  oprettet   timestamptz not null default now(),
  sidst_set  timestamptz not null default now()
);
create index push_abonnement_user_idx on public.push_abonnement (user_id);
alter table public.push_abonnement enable row level security;
-- No policy: the app never reads subscriptions back.

-- A login's toggles, one boolean per public.push_art (same names). No row =
-- everything on. The column names must match the enum labels: private.push
-- looks a toggle up by the art's name.
create table public.push_praeference (
  user_id                  uuid primary key references auth.users on delete cascade,
  bode_modtaget            boolean not null default true,
  anke_afstemning          boolean not null default true,
  anke_resultat            boolean not null default true,
  betalingsmelding_venter  boolean not null default true,
  betaling_bekraeftet      boolean not null default true,
  automatisk_gebyr         boolean not null default true,
  betalingspaamindelse     boolean not null default true
);
alter table public.push_praeference enable row level security;
create policy laes_egen on public.push_praeference for select to authenticated
  using (user_id = (select auth.uid()));
grant select on public.push_praeference to authenticated;

-- The outbox. One row = one push to one login (all its devices).
--   url         in-app path plus ?bodekasse=<id>, so a tap opens the right box
--   send_efter  not before this time (Bøde modtaget waits out Fortryd)
--   haendelse_id the feed entry it announces, if any; deleting the entry
--               (Fortryd) deletes the unsent push with it
--   paabegyndt  claimed by a sender run; a claim older than 5 minutes is retried
--   sendt / fejl one of them is set when the row is done
create table public.push_udbakke (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references auth.users on delete cascade,
  art           public.push_art not null,
  bodekasse_id  uuid not null references public.bodekasse on delete cascade,
  titel         text not null check (btrim(titel) <> ''),
  tekst         text not null,
  url           text not null check (url ~ '^/'),
  haendelse_id  bigint references public.haendelse on delete cascade,
  send_efter    timestamptz not null default now(),
  oprettet      timestamptz not null default now(),
  paabegyndt    timestamptz,
  sendt         timestamptz,
  fejl          text
);
create index push_udbakke_klar_idx on public.push_udbakke (send_efter)
  where sendt is null and fejl is null;
create index push_udbakke_user_idx on public.push_udbakke (user_id);
create index push_udbakke_haendelse_idx on public.push_udbakke (haendelse_id);
alter table public.push_udbakke enable row level security;
-- No policy: only the database and the sender touch the outbox.

-- ---------- Writing a push (the shared helper) ----------

-- Is this kind of push on for this login? No row = on.
create function private.push_til(p_login uuid, p_art public.push_art) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select (to_jsonb(p) ->> p_art::text)::boolean
       from public.push_praeference p where p.user_id = p_login),
    true)
$$;

-- Queues one push to a login, unless the login turned that kind off.
-- Call it in the same transaction as the event. p_sti is an in-app path such
-- as '/profil'; the box is added so the tap opens the right Bødekasse. Name
-- the Bødekasse in p_titel or p_tekst (a person may be in several).
-- Returns the outbox row id, or null when nothing was queued (no login, or
-- the kind is off).
create function private.push(
  p_login       uuid,
  p_art         public.push_art,
  p_bodekasse   uuid,
  p_titel       text,
  p_tekst       text,
  p_sti         text,
  p_send_efter  timestamptz default null,
  p_haendelse   bigint default null
) returns bigint
language plpgsql volatile security definer set search_path = '' as $$
declare v_id bigint;
begin
  if p_login is null or not private.push_til(p_login, p_art) then
    return null;
  end if;
  insert into public.push_udbakke (user_id, art, bodekasse_id, titel, tekst, url,
                                   send_efter, haendelse_id)
  values (p_login, p_art, p_bodekasse, p_titel, coalesce(p_tekst, ''),
          p_sti || case when position('?' in p_sti) > 0 then '&' else '?' end
                || 'bodekasse=' || p_bodekasse,
          coalesce(p_send_efter, now()), p_haendelse)
  returning id into v_id;
  return v_id;
end $$;

-- ---------- Waking the sender ----------

-- Asks the Edge Function to send, when there are due rows and the owner has
-- configured the sender in Vault (secrets 'push_send_url' and
-- 'push_send_secret', see docs/ops/push-setup.md). Otherwise, or on any
-- error, it does nothing: an event must never fail because of a push.
create function private.skub_push() returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_url        text;
  v_hemmelighed text;
begin
  if not exists (select 1 from public.push_udbakke
                  where sendt is null and fejl is null and send_efter <= now()) then
    return;
  end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'push_send_url';
  select decrypted_secret into v_hemmelighed from vault.decrypted_secrets where name = 'push_send_secret';
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
  raise warning 'skub_push: %', sqlerrm;
end $$;

create function private.push_udbakke_skub() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.skub_push();
  return null;
end $$;

create trigger skub after insert on public.push_udbakke
  for each statement execute function private.push_udbakke_skub();

-- The sweep: catches rows that waited (send_efter) and any missed wake-up.
-- The cron.job_run_details cleanup keeps the sweep's log from growing forever.
select cron.schedule('push-sweep', '30 seconds', 'select private.skub_push()');
select cron.schedule('cron-oprydning', '17 3 * * *',
  $$delete from cron.job_run_details where end_time < now() - interval '7 days'$$);

-- ---------- First event: Bøde modtaget ----------

-- Whole kroner the Danish way, like the app's formatKr: '1.250 kr'.
create function private.kr(p_beloeb int) returns text
language sql immutable set search_path = '' as $$
  select case when p_beloeb < 0 then '-' else '' end
      || regexp_replace(abs(p_beloeb)::text, '(\d)(?=(\d{3})+$)', '\1.', 'g')
      || ' kr'
$$;

-- giv_boeder writes one 'boeder_givet' feed entry per receiver per batch, so
-- a trigger on that entry gives exactly one push per receiver per batch. A
-- trigger (not a change to giv_boeder) keeps this independent of the RPC.
-- No push for a Bøde you gave yourself. The push waits out the Fortryd grace,
-- and Fortryd deletes the entry and so the push.
create function private.push_boeder_givet() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_login  uuid;
  v_kasse  text;
  v_giver  text;
  v_antal  int := coalesce((new.data ->> 'antal')::int, 0);
  v_linjer text;
begin
  if new.modtager_id is null or new.modtager_id is not distinct from new.aktoer_id then
    return null;
  end if;
  select user_id into v_login from public.medlem where id = new.modtager_id;
  if v_login is null then return null; end if;
  select navn into v_kasse from public.bodekasse where id = new.bodekasse_id;
  select navn into v_giver from public.medlem where id = new.aktoer_id;
  select string_agg(l ->> 'navn' || case when (l ->> 'antal')::int > 1
                                          then ' ×' || (l ->> 'antal') else '' end,
                    ', ' order by ord)
    into v_linjer
    from jsonb_array_elements(coalesce(new.data -> 'linjer', '[]'::jsonb)) with ordinality as x(l, ord);

  perform private.push(
    v_login, 'bode_modtaget', new.bodekasse_id,
    case when v_antal = 1 then 'Ny bøde i ' || v_kasse
         else v_antal || ' nye bøder i ' || v_kasse end,
    coalesce(v_giver, 'Nogen') || ' gav dig ' || coalesce(v_linjer, 'bøder')
      || ' · ' || private.kr(coalesce((new.data ->> 'beloeb')::int, 0)),
    '/profil',
    now() + private.fortryd_frist(),
    new.id);
  return null;
end $$;

create trigger push_boeder_givet after insert on public.haendelse
  for each row when (new.art = 'boeder_givet')
  execute function private.push_boeder_givet();

-- ---------- RPCs for the app ----------
-- These are naturally idempotent (upsert / delete / set), so they take no
-- one-time ID: repeating one changes nothing.

-- Stores this device's subscription for the logged-in person. Returns {}.
-- Errors: ikke_logget_ind (42501), abonnement_ugyldigt.
create function public.abonner_push(p_endpoint text, p_p256dh text, p_auth text)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_bruger uuid := (select auth.uid());
begin
  if v_bruger is null then raise exception 'ikke_logget_ind' using errcode = '42501'; end if;
  if coalesce(p_endpoint, '') !~ '^https://' or coalesce(btrim(p_p256dh), '') = ''
     or coalesce(btrim(p_auth), '') = '' then
    raise exception 'abonnement_ugyldigt';
  end if;
  insert into public.push_abonnement (user_id, endpoint, p256dh, auth)
  values (v_bruger, p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
        sidst_set = now();
  return '{}'::jsonb;
end $$;

-- Forgets this device (your own subscription only). Returns {}.
-- Errors: ikke_logget_ind (42501).
create function public.afmeld_push(p_endpoint text)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_bruger uuid := (select auth.uid());
begin
  if v_bruger is null then raise exception 'ikke_logget_ind' using errcode = '42501'; end if;
  delete from public.push_abonnement where endpoint = p_endpoint and user_id = v_bruger;
  return '{}'::jsonb;
end $$;

-- Turns one kind of push on or off for the logged-in person, in all their
-- boxes. Returns every toggle: {"bode_modtaget": true, ...}.
-- Errors: ikke_logget_ind (42501).
create function public.saet_push_praeference(p_art public.push_art, p_til boolean)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_bruger uuid := (select auth.uid());
  v_raekke public.push_praeference;
begin
  if v_bruger is null then raise exception 'ikke_logget_ind' using errcode = '42501'; end if;
  insert into public.push_praeference (user_id) values (v_bruger) on conflict do nothing;
  execute format('update public.push_praeference set %I = $1 where user_id = $2 returning *', p_art)
    into v_raekke using coalesce(p_til, true), v_bruger;
  return to_jsonb(v_raekke) - 'user_id';
end $$;

revoke execute on function public.abonner_push(text, text, text) from public, anon;
grant execute on function public.abonner_push(text, text, text) to authenticated;
revoke execute on function public.afmeld_push(text) from public, anon;
grant execute on function public.afmeld_push(text) to authenticated;
revoke execute on function public.saet_push_praeference(public.push_art, boolean) from public, anon;
grant execute on function public.saet_push_praeference(public.push_art, boolean) to authenticated;

-- ---------- RPCs for the sender (service_role only) ----------

-- Claims up to p_max due rows and returns them with the login's subscriptions:
-- {id, titel, tekst, url, art, abonnementer: [{endpoint, p256dh, auth}]}.
-- A row is due when unsent, not failed, past send_efter and not claimed in the
-- last 5 minutes. Concurrent runs never get the same row.
create function public.push_hent_klar(p_max int default 50)
returns setof jsonb
language plpgsql volatile security definer set search_path = '' as $$
begin
  return query
  with klar as (
    select id from public.push_udbakke
     where sendt is null and fejl is null and send_efter <= now()
       and (paabegyndt is null or paabegyndt < now() - interval '5 minutes')
     order by id
     limit greatest(coalesce(p_max, 50), 1)
       for update skip locked
  ), taget as (
    update public.push_udbakke u set paabegyndt = now()
      from klar where u.id = klar.id
    returning u.*
  )
  select jsonb_build_object(
           'id', t.id, 'art', t.art, 'titel', t.titel, 'tekst', t.tekst, 'url', t.url,
           'abonnementer', coalesce(
             (select jsonb_agg(jsonb_build_object('endpoint', a.endpoint, 'p256dh', a.p256dh,
                                                  'auth', a.auth) order by a.oprettet)
                from public.push_abonnement a where a.user_id = t.user_id),
             '[]'::jsonb))
    from taget t order by t.id;
end $$;

-- Marks a claimed row done: sent when p_fejl is null, else failed with it.
create function public.push_marker(p_id bigint, p_fejl text default null)
returns void
language sql volatile security definer set search_path = '' as $$
  update public.push_udbakke
     set sendt = case when p_fejl is null then now() end,
         fejl  = p_fejl
   where id = p_id and sendt is null and fejl is null
$$;

-- Deletes a subscription the push service called gone (404 / 410).
create function public.push_fjern_abonnement(p_endpoint text)
returns void
language sql volatile security definer set search_path = '' as $$
  delete from public.push_abonnement where endpoint = p_endpoint
$$;

revoke execute on function public.push_hent_klar(int) from public, anon, authenticated;
revoke execute on function public.push_marker(bigint, text) from public, anon, authenticated;
revoke execute on function public.push_fjern_abonnement(text) from public, anon, authenticated;
grant execute on function public.push_hent_klar(int) to service_role;
grant execute on function public.push_marker(bigint, text) to service_role;
grant execute on function public.push_fjern_abonnement(text) to service_role;
