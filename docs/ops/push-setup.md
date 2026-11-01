# Push setup

How to switch on Web Push (#81) in production, and how to check it on a real phone.

Until you do this, nothing breaks. The database still writes pushes to its outbox, but it never calls the sender. The app shows "Notifikationer virker ikke på denne enhed" instead of "Slå notifikationer til".

## The quick way

Run the wizard from a checkout of `spec/74-v1` (or `main` once merged). It does the backup, the migrations, every step below and the phone checks, and asks before each production command:

```bash
scripts/ship-push-wizard.sh
```

It keeps the keys in `supabase/functions/.env.production.local` (gitignored). Keep a copy of that file with your backups.

## How it fits together

1. An event (today: Bøder given) writes a row to `public.push_udbakke` in the same transaction.
2. The database wakes the Edge Function `send-push` through `pg_net`. It does this after each new push, and a `pg_cron` sweep does it every 30 seconds.
3. `send-push` sends each row to every device of the person, using Web Push and VAPID. It marks the row sent or failed. It deletes a device the push service reports as gone (404 or 410).

A "Bøde modtaget" push waits 30 seconds, so a giver can still use Fortryd. Expect it 30 to 60 seconds after the Bøder are given.

## What you configure

| Where | Name | Value |
|---|---|---|
| Edge Function secret | `VAPID_PUBLIC_KEY` | Public VAPID key (base64url) |
| Edge Function secret | `VAPID_PRIVATE_KEY` | Private VAPID key (base64url). Never put it anywhere else. |
| Edge Function secret | `VAPID_SUBJECT` | `mailto:` plus your email, e.g. `mailto:you@example.com` |
| Edge Function secret | `PUSH_SEND_SECRET` | A long random string |
| Vault secret | `push_send_url` | `https://<project-ref>.supabase.co/functions/v1/send-push` |
| Vault secret | `push_send_secret` | The same string as `PUSH_SEND_SECRET` |
| Vercel env (Production) | `VITE_VAPID_PUBLIC_KEY` | The same public VAPID key |
| Extensions | `pg_net`, `pg_cron` | The migration enables both. Check they are on. |

Supabase gives the function `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` by itself.

## Steps

Take a backup first (see [backup-and-rollback.md](backup-and-rollback.md)).

1. **Deploy the migration** as usual. It adds the tables and the outbox, schedules the cron jobs `push_sweep` and `cron_oprydning`, and enables `pg_net` and `pg_cron`.

2. **Make a VAPID key pair.** Do it once, and keep the keys. A new pair makes every phone subscribe again.

   ```bash
   npx web-push generate-vapid-keys
   ```

3. **Make the shared secret.**

   ```bash
   openssl rand -hex 32
   ```

4. **Set the function secrets.**

   ```bash
   supabase secrets set --project-ref <project-ref> \
     VAPID_PUBLIC_KEY=<public key> \
     VAPID_PRIVATE_KEY=<private key> \
     VAPID_SUBJECT=mailto:<your email> \
     PUSH_SEND_SECRET=<shared secret>
   ```

5. **Deploy the function.** `supabase/config.toml` already turns off JWT checks for it. The flag repeats that.

   ```bash
   supabase functions deploy send-push --project-ref <project-ref> --no-verify-jwt
   ```

6. **Store the URL and secret in Vault.** Run this in the dashboard's SQL editor.

   ```sql
   select vault.create_secret('https://<project-ref>.supabase.co/functions/v1/send-push', 'push_send_url');
   select vault.create_secret('<shared secret>', 'push_send_secret');
   ```

   To change one later, use `vault.update_secret(id, new_value)`. Find the id in `vault.secrets`.

7. **Set `VITE_VAPID_PUBLIC_KEY`** in Vercel (Project → Settings → Environment Variables → Production). Then redeploy the app, because Vite reads it at build time.

8. **Check the sweep runs.**

   ```sql
   select jobname, schedule, active from cron.job;
   select status, return_message, start_time from cron.job_run_details
    order by start_time desc limit 5;
   ```

   You should see `push_sweep` every 30 seconds and `cron_oprydning` once a day.

## Check on a phone

Do both phones. Use two logins, so one can give the other a Bøde.

### iPhone (iOS 16.4 or newer, 17.5+ recommended)

1. Open the app's URL in Safari. Tap Del → Føj til hjemmeskærm. In a Safari tab, the install guide shows "Installér appen for at få notifikationer".
2. Open the app from the home screen and log in.
3. Go to Mere → Notifikationer (the row says "Fra"). Tap "Slå notifikationer til". Allow notifications.
4. The card turns into eight toggles. "Bøder til dig" is on, "Aktivitet fra andre" is off. Back on Mere, the row says "Til".
5. Lock the phone. From the other login, give this person two Bøder in one go.
6. Within about a minute, one notification arrives. It says "2 nye bøder i <Bødekasse>", who gave them and the total.
7. Tap it. The app opens on your profile in that Bødekasse.
8. Turn "Bøder til dig" off. Give another Bøde. No notification arrives.
9. Give a Bøde and tap Fortryd at once. No notification arrives.

### Android (Chrome)

1. Open the app's URL in Chrome. Use the menu → Install app (or Add to Home screen).
2. Open the installed app, log in and repeat steps 3 to 9 above.

### If nothing arrives

- Look at the outbox:

  ```sql
  select id, art, titel, send_efter, paabegyndt, sendt, fejl
    from public.push_udbakke order by id desc limit 10;
  ```

  - `sendt` set: the push service took it. Check the phone's notification settings.
  - `fejl = 'ingen_abonnement'`: that login has no device. Tap "Slå notifikationer til" again.
  - `fejl` is a status code such as `403`: the VAPID keys don't match. The app and the function must use the same public key.
  - Nothing set: the sender never ran. Check the Vault names, the function logs and `net._http_response`.

- Function logs: Dashboard → Edge Functions → send-push → Logs.

## Local development

Pushes need a service worker, and `npm run dev` has none. Use `npm run build && npm run preview` to test locally.

Keep local keys out of git:

- `supabase/functions/.env` for the function secrets. It is in `.gitignore`.
- `.env.development.local` or `.env.production.local` for `VITE_VAPID_PUBLIC_KEY`.

Never reuse production keys locally.
