# Profilbillede cleanup setup

How to switch on the cleanup of Profilbillede files (#104), and how to check it once on staging.

Until you do this, nothing breaks. The database still queues old picture paths in its cleanup outbox. It just never deletes the files, so they stay in Storage.

## How it fits together

1. A picture stops being needed. The database writes its Storage path to `public.billede_oprydning` in the same transaction. This happens when a Medlem:
   - replaces or removes their picture (the old file)
   - is deleted with Slet medlem (every file in their folder)
   - is in a Bødekasse that is deleted (every file in the box)
   - loses their login with Slet konto (every file of their Medlemmer; the pictures are cleared too)
2. An Udmeldt Medlem keeps the picture. Nothing is queued.
3. The hourly automation run (`koer_automatik`, on the hour) ends by waking the Edge Function `ryd-billeder` through `pg_net`. It does this only when paths are due.
4. `ryd-billeder` claims the due rows and deletes the files through the Storage API. Then it marks the rows done.
   - A file that is already gone counts as deleted.
   - A done row is never handed out again.
   - On a Storage error, the row keeps the error and a later run tries again, at most 10 times.

So a file goes within about an hour after it was queued.

## What you configure

| Where | Name | Value |
|---|---|---|
| Edge Function secret | `RYD_BILLEDER_SECRET` | A long random string |
| Vault secret | `ryd_billeder_url` | `https://<project-ref>.supabase.co/functions/v1/ryd-billeder` |
| Vault secret | `ryd_billeder_secret` | The same string as `RYD_BILLEDER_SECRET` |
| Extensions | `pg_net`, `pg_cron` | Already on since spec #74. Check they are on. |

Supabase gives the function `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` by itself.

## Steps

Do these on staging first. Then repeat them on production with the production project ref.

Take a backup first (see [backup-and-rollback.md](backup-and-rollback.md)).

1. **Deploy the migrations** as usual. `20261103100000_billede_oprydning.sql` adds the outbox. It also makes the hourly run wake the cleanup.

2. **Make the shared secret.** Use a new one, not the push secret.

   ```bash
   openssl rand -hex 32
   ```

3. **Set the function secret.**

   ```bash
   supabase secrets set --project-ref <project-ref> RYD_BILLEDER_SECRET=<shared secret>
   ```

4. **Deploy the function.** `supabase/config.toml` already turns off JWT checks for it. The flag repeats that.

   ```bash
   supabase functions deploy ryd-billeder --project-ref <project-ref> --no-verify-jwt
   ```

5. **Store the URL and secret in Vault.** Run this in the dashboard's SQL editor.

   ```sql
   select vault.create_secret('https://<project-ref>.supabase.co/functions/v1/ryd-billeder', 'ryd_billeder_url');
   select vault.create_secret('<shared secret>', 'ryd_billeder_secret');
   ```

   To change one later, use `vault.update_secret(id, new_value)`. Find the id in `vault.secrets`.

6. **Check the hourly job runs.**

   ```sql
   select jobname, schedule, active from cron.job where jobname = 'koer_automatik';
   ```

   You should see `0 * * * *` and `active = true`.

## Check on staging (once, by hand)

The Edge Function has no unit tests. This check is its test. Use the staging project and the app on a phone or in a browser.

1. **Make a file to delete.** Log in to the staging app. Set a profile picture in a Bødekasse. Then set a different one.

2. **See the old path in the outbox.** In the SQL editor:

   ```sql
   select id, sti, oprettet, paabegyndt, forsoeg, slettet, fejl
     from public.billede_oprydning order by id desc limit 5;
   ```

   One row shows the first picture's path, with `slettet` empty. Write down its `sti`.

3. **Check the file still exists.** Dashboard → Storage → `profilbilleder`. Open the folder from the path (`<bodekasse>/<medlem>/`). Both files are there.

4. **Wake the cleanup now**, instead of waiting for the hour.

   ```sql
   select private.koer_automatik(now());
   ```

5. **Check the call went out.** Wait 10 seconds, then:

   ```sql
   select status_code, content, created from net._http_response order by created desc limit 3;
   ```

   The newest row has `status_code = 200` and content like `{"slettet":1,"fejlet":0}`.
   - `401`: the Vault secret and `RYD_BILLEDER_SECRET` don't match.
   - No row at all: check the Vault names, `ryd_billeder_url` and the function logs.

6. **Check the row is done and the file is gone.**
   - Run the query from step 2 again. The row now has `slettet` set and `fejl` empty.
   - Reload the Storage folder. The old file is gone. The current picture is still there and still shows in the app.

7. **Check it is not sent twice.** Run step 4 again, then step 5. No new `ryd-billeder` call appears, because nothing is due.

8. **Check a missing file is fine.** Queue the path you already deleted, then wake the cleanup:

   ```sql
   insert into public.billede_oprydning (sti) values ('<the sti from step 2>');
   select private.koer_automatik(now());
   ```

   After 10 seconds, the new row has `slettet` set and `fejl` empty. The response says `{"slettet":1,"fejlet":0}`.

9. **Optional: Slet konto.** Log in with a throwaway login that has a picture. Delete the account in the app. After step 4, every file in that login's folders is gone.

If all of this works, write "ryd-billeder checked on staging" with the date in the ticket.

### If a row stays undone

- `fejl` is set: Storage refused. Read the message and the function logs. The row retries after 5 minutes, at the next hourly run, at most 10 times.
- `paabegyndt` is empty: the function never ran. Check the Vault names and `net._http_response`.
- Function logs: Dashboard → Edge Functions → ryd-billeder → Logs.

## Local development

Keep the local secret out of git: put `RYD_BILLEDER_SECRET` in `supabase/functions/.env`. It is in `.gitignore`.

Never reuse production secrets locally.
