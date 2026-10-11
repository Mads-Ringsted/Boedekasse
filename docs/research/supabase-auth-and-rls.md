# Supabase auth, claiming a spot, and keeping each Bødekasse's data separate

Research for [#5](https://github.com/Mads-Ringsted/Boedekasse/issues/5). Researched 2026-10-10.

**How the sources were read.** supabase.com and postgresql.org are blocked by this environment's egress policy, so I read the same docs from the repositories they are published from:

- Supabase docs: `apps/docs/content/**` in [supabase/supabase@8617532](https://github.com/supabase/supabase/tree/8617532ae1a41571d5d557cd24c6f5f2565d9230) (2026-10-09). Numbers shown as `<SharedData>` in the MDX resolve from [`packages/shared-data/config.ts`](https://github.com/supabase/supabase/blob/8617532ae1a41571d5d557cd24c6f5f2565d9230/packages/shared-data/config.ts). Every claim below links to the published page on supabase.com/docs.
- Supabase Auth server: [supabase/auth@ce9a8ee](https://github.com/supabase/auth/tree/ce9a8eee0cc042be8c7a42981a7ddae631e41d91) (2026-09-22).
- Postgres docs: SGML sources in [postgres/postgres `REL_17_STABLE`](https://github.com/postgres/postgres/tree/REL_17_STABLE/doc/src/sgml).

Terms follow `GLOSSARY.md` (Bødekasse, Medlem, Admin, Bødekategori, Bøde, Gebyr, Konkurrence, Indbetaling, Saldo).

---

## 1. Email OTP (6-digit code, not magic link)

### Facts

- **OTP and magic link are the same mechanism. Only the email differs.** "Email OTPs share an implementation with Magic Links. To send an OTP instead of a Magic Link, alter the **Magic Link** email template", and include `{{ .Token }}`. Email auth is enabled by default. ([Passwordless email logins](https://supabase.com/docs/guides/auth/auth-email-passwordless#with-otp))
- **Template variables:** `{{ .Token }}` "Contains a 6-digit One-Time-Password (OTP) that can be used instead of the `{{ .ConfirmationURL }}`." ([Email templates](https://supabase.com/docs/guides/auth/auth-email-templates#terminology))
- **First-time users get the "Confirm sign up" template, not the "Magic link" one.** In the Auth server, `signInWithOtp` for an email with no confirmed user calls the sign-up path, and "otherwise confirmation email already contains 'magic link'" ([`magic_link.go` L82–L124](https://github.com/supabase/auth/blob/ce9a8eee0cc042be8c7a42981a7ddae631e41d91/internal/api/magic_link.go#L82-L124)). Only the Magic Link template is mentioned in the OTP guide. **Both templates must be edited to show `{{ .Token }}`.** Every Medlem who claims a spot is a first-time user, so this is the template they actually see.
- **One verify call covers both cases.** `verifyOtp({ email, token, type: 'email' })` creates the session ([guide, step 2](https://supabase.com/docs/guides/auth/auth-email-passwordless#step-2-verify-the-otp-to-create-a-session)). Server-side, type `email` checks both the confirmation token (sign-up) and the recovery token (magic link) ([`verify.go` L650–L683](https://github.com/supabase/auth/blob/ce9a8eee0cc042be8c7a42981a7ddae631e41d91/internal/api/verify.go#L650-L683)).
- **Code length:** 6 by default, configurable 6–10 (`auth.email.otp_length` in [CLI config](https://supabase.com/docs/guides/local-development/cli/config#auth.email.otp_length), `mailer_otp_length` min 6 max 10 in the Management API spec). The server falls back to 6 when the value is out of range ([`configuration.go` L1237](https://github.com/supabase/auth/blob/ce9a8eee0cc042be8c7a42981a7ddae631e41d91/internal/conf/configuration.go#L1237)).
- **Expiry:** default 1 hour (`otp_expiry` 3600 s). Expiry is set in *Authentication > Sign In / Providers > Email > Email OTP expiration*. Values above 86,400 s are "strongly discouraged" and settable only via the Management API. The same setting also governs magic, confirmation, recovery and invite links. ([guide](https://supabase.com/docs/guides/auth/auth-email-passwordless#with-otp))
- **Auto sign-up:** `signInWithOtp` creates the user if they don't exist unless `shouldCreateUser: false` ([guide](https://supabase.com/docs/guides/auth/auth-email-passwordless#step-1-send-the-user-an-otp-code)).
- **Why OTP suits the PWA:** links get consumed by mail scanners ("Token has expired or is invalid"), and the docs' first remedy is to use `{{ .Token }}` instead ([Email templates, Email prefetching](https://supabase.com/docs/guides/auth/auth-email-templates#email-prefetching)). Leaving `{{ .ConfirmationURL }}` out of the templates also keeps users from opening Safari.

### Rate limits ([Rate limits](https://supabase.com/docs/guides/auth/rate-limits); values from `shared-data/config.ts`)

| Limit | Default | Scope |
| --- | --- | --- |
| Emails sent, built-in SMTP | **2 per hour** | project |
| Emails sent, custom SMTP | starts at **30 per hour**, adjustable ([SMTP guide](https://supabase.com/docs/guides/auth/auth-smtp)) | project |
| `/auth/v1/otp` per user | one request per **60 s** | user |
| Sign-ups and sign-ins (`/otp`, `/signup`, …) | 30 per 5 min, burst 30 | IP |
| `/auth/v1/verify` | 30 per 5 min, burst 30 | IP |
| `/auth/v1/token` (refresh) | 150 per 5 min, burst 30 | IP |

The limits are token buckets and return **429** when exceeded. They can be changed in *Authentication > Rate Limits* or with `PATCH /v1/projects/{ref}/config/auth` (`rate_limit_email_sent`, `rate_limit_otp`, `rate_limit_verify`, …).

A friend group usually shares one IP (same Wi-Fi). The per-IP limit of 30 sign-ins per 5 minutes is fine for that.

### Custom SMTP is required, even for a small group

The built-in email service ([Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)):

- **only delivers to members of the Supabase organization's team**: "All other addresses will fail with the error message *Email address not authorized*";
- sends 2 messages per hour, "can change without notice";
- has no SLA and is meant for exploring, demos and toy projects.

So **no friend outside the Supabase team can log in at all without custom SMTP**. The docs list Resend, AWS SES, Postmark, SendGrid, ZeptoMail and Brevo as options. The alternative is the **Send Email hook**, which lets you send through your own HTTP endpoint. It is available on Free and Pro ([Auth hooks](https://supabase.com/docs/guides/auth/auth-hooks)), and the email limit becomes configurable with either option. Recommended alongside: SPF, DKIM and DMARC on the sending domain, and auth-only email content ([SMTP guide, best practices](https://supabase.com/docs/guides/auth/auth-smtp#additional-best-practices)).

### Recommendation

1. Configure custom SMTP (for example Resend on a subdomain such as `auth.<domain>`) before anyone outside the dev team tests.
2. Edit **both** "Confirm sign up" and "Magic link or OTP" to show only `{{ .Token }}`, with no link. Keep 6 digits.
3. Client: `signInWithOtp({ email })` → code screen → `verifyOtp({ email, token, type: 'email' })`. Show a 60-second resend cooldown that mirrors the server limit.
4. Leave `shouldCreateUser` at its default (`true`), because claiming a spot depends on a first-time sign-in creating the user. Decide separately whether people *without* a pre-added Medlem may sign up (they need to, to create a Bødekasse).
5. Consider shortening OTP expiry (for example 10–15 minutes). Note that the expiry also applies to invite links if those are ever used.

---

## 2. Claiming a spot (Medlem exists as name + email before sign-up)

### Facts

- **Emails are stored lowercase.** Auth lowercases the email on input ([`mail.go` validateEmail](https://github.com/supabase/auth/blob/ce9a8eee0cc042be8c7a42981a7ddae631e41d91/internal/api/mail.go#L710-L722)) and looks users up by `LOWER(email)` ([`user.go` L699–L701](https://github.com/supabase/auth/blob/ce9a8eee0cc042be8c7a42981a7ddae631e41d91/internal/models/user.go#L699-L701)). Store Medlem emails lowercased and match on `lower(email)`.
- **The `auth.users` row exists before the code is verified.** For an unconfirmed user, `signInWithOtp` runs sign-up and inserts the row with `email_confirmed_at` null. A successful verify then runs `User.Confirm`, which does `UpdateOnly(u, "confirmation_token", "email_confirmed_at")` ([`user.go` L524–L529](https://github.com/supabase/auth/blob/ce9a8eee0cc042be8c7a42981a7ddae631e41d91/internal/models/user.go#L524-L529)). A Postgres `AFTER UPDATE OF email_confirmed_at` trigger fires when that column is a target of the `UPDATE` ([CREATE TRIGGER](https://github.com/postgres/postgres/blob/REL_17_STABLE/doc/src/sgml/ref/create_trigger.sgml)).
- **Triggers on `auth.users` are the documented pattern.** The docs show `after insert on auth.users … security definer set search_path = ''` and warn: "If the trigger fails, it could block signups, so test your code thoroughly." ([Managing user data](https://supabase.com/docs/guides/auth/managing-user-data#accessing-user-data-via-api))
- **References to `auth.users` should use only its primary key**, because other Supabase-managed columns "may change at any time" ([same page](https://supabase.com/docs/guides/auth/managing-user-data#accessing-user-data-via-api)).
- **The access token carries `email`** (a required claim in [JWT fields](https://supabase.com/docs/guides/auth/jwt-fields)), so an RPC can read it with `auth.jwt() ->> 'email'`.
- **Auth hooks:** a "Before User Created" hook exists (Free and Pro) ([Auth hooks](https://supabase.com/docs/guides/auth/auth-hooks)). It runs *before* the row exists, so it can't link a user id. It isn't needed here.

### Options compared

| Option | Covers "Medlem added after the person already has an account"? | Risk |
| --- | --- | --- |
| A. Trigger on `auth.users` (insert/confirm) | No, needs B too | A bug blocks all sign-ups |
| B. Trigger on `medlem` insert (looks up `auth.users`) | Yes | Needs `security definer` to read `auth` |
| C. RPC `claim_spots()` called by the client after each sign-in | Yes, on next sign-in | Silent if the client forgets to call it; latency until next login |

### Recommendation: A + B, both in Postgres

The spot is claimed the moment the email is proven, in any number of Bødekasser at once, without the client having to remember anything:

```sql
-- medlem.user_id is null until claimed; email stored lowercase
create table public.medlem (
  id            uuid primary key default gen_random_uuid(),
  bodekasse_id  uuid not null references public.bodekasse(id) on delete cascade,
  navn          text not null,
  email         text not null check (email = lower(email)),
  user_id       uuid references auth.users(id) on delete set null,
  er_admin      boolean not null default false,
  unique (bodekasse_id, email),
  unique (bodekasse_id, user_id),
  unique (bodekasse_id, id)                 -- target for composite FKs (section 3)
);
create index on public.medlem (user_id);    -- RLS filters on this (section 3)
create index on public.medlem (email) where user_id is null;

-- A: claim when the email is confirmed (first OTP verify)
create function private.claim_on_confirm() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.medlem
     set user_id = new.id
   where email = lower(new.email) and user_id is null;
  return new;
end $$;

create trigger claim_medlem_on_confirm
  after insert or update of email_confirmed_at on auth.users
  for each row when (new.email_confirmed_at is not null)
  execute function private.claim_on_confirm();

-- B: claim immediately if the person already has a confirmed account
create function private.claim_on_medlem_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.email := lower(new.email);
  if new.user_id is null then
    select u.id into new.user_id
      from auth.users u
     where lower(u.email) = new.email and u.email_confirmed_at is not null;
  end if;
  return new;
end $$;

create trigger claim_medlem_on_insert
  before insert on public.medlem
  for each row execute function private.claim_on_medlem_insert();
```

Notes:

- **Claim only on a confirmed email.** The `auth.users` row appears as soon as someone *requests* a code for an address. Linking at that point would be harmless, because no session is issued without the code, but linking on confirm is cleaner.
- **Keep the `auth.users` trigger tiny and test it with pgTAP.** If this trigger fails, every sign-up fails with it. `unique (bodekasse_id, email)` means the update touches at most one row per Bødekasse, so it can't violate `unique (bodekasse_id, user_id)` in normal use.
- **After the claim, `user_id` is the identity.** The Medlem's email is then just contact info. If an Admin later edits it, the claim isn't undone.
- **`on delete set null`** on `user_id` keeps a deleted account's Bøder and Indbetalinger history. The Medlem simply becomes unclaimed again.
- **Product question to settle:** pre-adding someone's email makes them a Medlem the moment they sign in, without an accept step. That matches the glossary ("signing in with that email claims the spot"). If consent is wanted later, add an `accepteret_at` column rather than changing the linking.
- Option C can be added later as a self-healing fallback (`update … where email = auth.jwt()->>'email' and user_id is null`). It isn't needed for v1.

---

## 3. Multi-tenant isolation with RLS

### Facts

- **Grants and RLS are separate.** "Grants decide whether a role can run an operation on the table at all. Policies decide which rows." On existing projects, new `public` tables auto-grant `select/insert/update/delete` to `anon`, `authenticated` and `service_role`, and functions get `EXECUTE`. "Adding policies doesn't take those grants back." Supabase is moving to revoke these by default. ([RLS: Grants and policies](https://supabase.com/docs/guides/database/postgres/row-level-security#grants-and-policies), [Securing your API: Default privileges](https://supabase.com/docs/guides/api/securing-your-api#default-privileges))
- **Permissive policies are OR-ed.** "All permissive policies which are applicable to a given query will be combined together using the Boolean OR operator … Policies are permissive by default." ([CREATE POLICY](https://github.com/postgres/postgres/blob/REL_17_STABLE/doc/src/sgml/ref/create_policy.sgml))
- **UPDATE needs a matching SELECT policy**, and `with check` stops a row from being moved into another tenant ([RLS: UPDATE policies](https://supabase.com/docs/guides/database/postgres/row-level-security#update-policies)).
- **Avoid recursive policies.** A policy on `medlem` that reads `medlem` (or two tables reading each other) raises `42P17 infinite recursion`. The documented fix is a `security definer` function owned by `postgres` (which has `bypassrls`) that returns the caller's group ids: `id in (select private.user_list_ids())` ([RLS: Avoid recursive policies](https://supabase.com/docs/guides/database/postgres/row-level-security#avoid-recursive-policies)).
- **Security definer rules:** use `set search_path = ''` with schema-qualified names, and never put one in an exposed schema ("callable over the Data API with the creator's privileges"). Revoke `execute` from `public`/`anon` and grant it explicitly ([RLS: security definer](https://supabase.com/docs/guides/database/postgres/row-level-security#use-security-definer-functions), [Database functions](https://supabase.com/docs/guides/database/functions#security-definer-vs-invoker)). Postgres grants `EXECUTE` to `PUBLIC` on every new function by default ([CREATE FUNCTION](https://github.com/postgres/postgres/blob/REL_17_STABLE/doc/src/sgml/ref/create_function.sgml)).
- **Don't put per-Bødekasse roles in the JWT.** `user_metadata` is user-editable. `app_metadata` claims are stale until the token refreshes ("even if you remove a user from a team … that will not be reflected using `auth.jwt()` until the user's JWT is refreshed") ([RLS: `auth.jwt()`](https://supabase.com/docs/guides/database/postgres/row-level-security#authjwt)). A table lookup is immediate and handles any number of Bødekasser.
- **Foreign key checks bypass RLS.** "Referential integrity checks, such as unique or primary key constraints and foreign key references, always bypass row security" ([Postgres: Row Security Policies](https://github.com/postgres/postgres/blob/REL_17_STABLE/doc/src/sgml/ddl.sgml)). An RLS check on `bodekasse_id` alone therefore does not stop a Bøde in box X pointing at a Medlem of box Y. Composite FKs do.

### Performance pitfalls ([RLS](https://supabase.com/docs/guides/database/postgres/row-level-security#add-indexes), [RLS performance](https://supabase.com/docs/guides/database/postgres/row-level-security-performance))

1. **Wrap function calls in `select`**: `(select auth.uid())` and `(select private.f())`. This causes an `initPlan`, which caches the result per statement instead of calling it per row. It is only valid when the result does not depend on the row. Consequence: `private.is_admin(bodekasse_id)` *with a row argument* can't be cached. Prefer a set-returning `private.admin_bodekasser()` used as `bodekasse_id in (select …)`.
2. **Index every column a policy filters on.** "A column counts as indexed only when it comes first in a btree index". So `(bodekasse_id, user_id)` does **not** index `user_id`.
3. **Always name the role** (`to authenticated`), so the policy isn't evaluated for `anon`.
4. **Avoid joins to the source row in a policy.** Select the caller's ids into a set and use `in`/`any`. The docs suggest re-checking performance above about 1,000 items, which is far beyond a person's number of Bødekasser.
5. **Filter in the client too** (`.eq('bodekasse_id', id)`) even though RLS would. This gives the planner a better plan.

### Recommended shape

- Every tenant table (`bodekategori`, `bode`, `gebyr`, `indbetaling`, `konkurrence`, `anke`, settings …) has its own **`bodekasse_id` column**, indexed, so every policy is the same one-line check with no joins.
- References between tenant rows are **composite FKs** that include `bodekasse_id`, for example `foreign key (bodekasse_id, medlem_id) references medlem (bodekasse_id, id)`. Cross-tenant references are then impossible regardless of RLS.
- Helpers live in an **unexposed `private` schema**:

```sql
create schema if not exists private;

create function private.mine_bodekasser() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select bodekasse_id from public.medlem where user_id = (select auth.uid())
$$;

create function private.admin_bodekasser() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select bodekasse_id from public.medlem
   where user_id = (select auth.uid()) and er_admin
$$;

create function private.mit_medlem_id(p_bodekasse uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select id from public.medlem
   where bodekasse_id = p_bodekasse and user_id = (select auth.uid())
$$;

revoke execute on all functions in schema private from public, anon;
grant usage on schema private to authenticated;
grant execute on all functions in schema private to authenticated;
```

- Policies (example for `bode`; the other tables follow the same pattern):

```sql
alter table public.bode enable row level security;
revoke all on public.bode from anon;

create policy "Medlemmer ser Bøder i egne Bødekasser" on public.bode
  for select to authenticated
  using (bodekasse_id in (select private.mine_bodekasser()));

create policy "Medlemmer giver Bøder i egne Bødekasser" on public.bode
  for insert to authenticated
  with check (
    bodekasse_id in (select private.mine_bodekasser())
    and givet_af = private.mit_medlem_id(bodekasse_id)  -- can't fine "as" someone else
  );

-- Admin-only tables/ops (Indbetaling, settings, Medlem management):
create policy "Admins registrerer Indbetalinger" on public.indbetaling
  for insert to authenticated
  with check (bodekasse_id in (select private.admin_bodekasser()));
```

- **Creating a Bødekasse** needs an RPC: a `security definer` function in `public`, so it can be called with `supabase.rpc`. It inserts the Bødekasse and the creator's Admin Medlem in one transaction. Without it there is a chicken-and-egg problem: you can't pass a "Medlem of this Bødekasse" check before your Medlem row exists. Check `auth.uid() is not null` inside it and revoke it from `anon`.
- Make sure the **last Admin can't be removed or demoted**, with a trigger on `medlem`.
- `service_role` / secret keys bypass RLS. Keep them out of the SPA ([Bypassing RLS](https://supabase.com/docs/guides/database/postgres/row-level-security#bypassing-row-level-security)).
- Test with pgTAP (`supabase test db`) and `supabase-test-helpers` (`tests.authenticate_as()`): member, non-member and Admin cases per table ([RLS: Run the test suite](https://supabase.com/docs/guides/database/postgres/row-level-security#run-the-test-suite)).

---

## 4. Server-side logic: where automatic Gebyrer are created, and scheduling

### Facts

- **Edge Functions** are recommended for HTTP endpoints, webhook receivers, transactional email, bots and calls to external APIs ([Edge Functions: When to use](https://supabase.com/docs/guides/functions#when-to-use-edge-functions)). Limits: 256 MB memory, **2 s CPU per request**, 150 s wall clock on Free (400 s paid), 150 s idle timeout ([Limits](https://supabase.com/docs/guides/functions/limits)). Free includes 500,000 invocations per month ([Billing](https://supabase.com/docs/guides/platform/billing-on-supabase#variable-usage-fees-and-quotas)).
- **Database functions** are called with `supabase.rpc()`. They default to `security invoker`, and "Prefer `security invoker`". Use `definer` only with a pinned `search_path`, ownership checks in the body and narrowed `execute` ([Database functions](https://supabase.com/docs/guides/database/functions#security-definer-vs-invoker)).
- **Cron:** Supabase Cron is built on `pg_cron`. It can run SQL or database functions "with zero network latency" or make HTTP requests (via `pg_net`) to call an Edge Function, at intervals from every second to yearly. Recommendation: at most 8 concurrent jobs, each under 10 minutes. `cron.job_run_details` is never cleaned up automatically, so schedule a cleanup job ([Cron](https://supabase.com/docs/guides/cron), [Cron quickstart](https://supabase.com/docs/guides/cron/quickstart)). The docs I read mention no plan restriction.
- **Cron time zone:** `pg_cron` runs in **GMT** by default (`cron.timezone`, a `postgresql.conf` setting) ([pg_cron README](https://github.com/citusdata/pg_cron#readme)), and Supabase's examples are all in GMT. I found no Supabase doc saying `cron.timezone` can be changed on hosted projects. Plan on UTC schedules and do Danish-time logic in SQL (`now() at time zone 'Europe/Copenhagen'`). `pg_cron` supports `$` for "last day of month", but not "first Monday".

### Recommendation

**Create every Gebyr in Postgres, in the same transaction as the event that causes it.** It is atomic, has no network hop, can't be bypassed by a client, and works within the RLS model. Edge Functions are for things that leave the database: email notifications, push later, the MobilePay webhook later.

| Gebyr | Mechanism |
| --- | --- |
| New Bødekategori (Bødekasseloven §3: 25 kr from 1 Oct) | `AFTER INSERT` trigger on `bodekategori` (`security definer`). It reads the Bødekasse's setting (on/off, amount, start date) and inserts a Gebyr for the creating Medlem. A trigger means no insert path can skip it. Medlemmer get no direct `insert` grant or policy on `gebyr`. |
| Konkurrence placements (§5, entered by hand) | RPC `registrer_konkurrence_placeringer(konkurrence_id, placeringer jsonb)`. It checks the caller is an Admin of that Bødekasse, inserts placements plus Gebyrer atomically, and is idempotent via `unique (konkurrence_id, medlem_id)`. |
| Lost Anke | The same RPC pattern for "afgør Anke". |
| Frikøb (§6/§7) | No scheduled job. Store `frikob_aar`, exclude covered Bøder when computing Saldo, and never exclude Gebyrer. Year rollover then needs no cron. |

**Scheduling later:** prefer computing state at read time (Saldo as a view with `security_invoker = true`, see [RLS: views](https://supabase.com/docs/guides/database/postgres/row-level-security#expose-a-view-safely)) over scheduled mutations. When scheduling is needed (for example closing a monthly Konkurrence, or reminders), use one `pg_cron` job that runs hourly or daily in UTC and calls a SQL function. That function decides in Copenhagen time whether anything is due, such as "is today the first Monday?". Use `pg_net`-to-Edge-Function only when the job must reach the outside world. Add the `cron.job_run_details` cleanup job when the first job is added.

---

## 5. Free-tier limits that matter here

From [Billing on Supabase](https://supabase.com/docs/guides/platform/billing-on-supabase), [Billing FAQ](https://supabase.com/docs/guides/platform/billing-faq), [Project pausing](https://supabase.com/docs/guides/platform/free-project-pausing), [Backups](https://supabase.com/docs/guides/platform/backups), [Edge Function limits](https://supabase.com/docs/guides/functions/limits):

| Item | Free plan |
| --- | --- |
| **Pausing** | Paused after low "user database activity" over **7 days**. A warning email goes out about a week ahead. "Typically a few user requests to the database each day over the previous week is enough." Restorable for 1 year. Paid plans never pause. |
| **Auth email** | Built-in SMTP: 2 per hour, team addresses only → **custom SMTP is mandatory** (section 1). |
| Projects | 2 active free projects per Owner/Admin across orgs. Paused ones don't count. |
| Database | 500 MB per project |
| Auth MAU | 50,000 |
| Egress | 5 GB |
| Edge Functions | 500,000 invocations; 150 s wall clock; 2 s CPU |
| Realtime | 2 M messages, 200 peak connections |
| Backups | None listed for Free. Pro gets 7 days. Docs advise Free projects to `supabase db dump` regularly. |
| Price to remove pausing | Pro, $25/month (`shared-data/plans.ts`) |

**Implications:** a friend group that uses the app weekly will normally stay active, but a quiet month (summer, holidays) can trigger a pause. The owner gets about a week's warning by email, and resuming is one click. The docs don't say whether `pg_cron` jobs inside the database count as "user activity", so don't rely on them as a keep-alive. Do a scheduled `supabase db dump` (for example from GitHub Actions), because Free has no listed backups. Use a second free project for staging, within the 2-project limit.

---

## Open questions and things not verified

- Whether hosted Supabase allows changing `cron.timezone` (assumed no; design around UTC).
- Whether pg_cron or internal traffic counts against pausing (not documented).
- The chosen SMTP provider's own free-tier quota (not researched; outside Supabase).
- The consent question in section 2 (auto-join on sign-in vs. an accept step) is a product decision for the Bødekasse and membership ticket (#11).
