# Backup and rollback

How to back up the production database before a deploy, and how to roll back if the deploy goes wrong.

Production runs on Supabase Free. Free has no built-in backups you can restore from, so this dump is the only safety net. Take one before **every** migration deploy.

## Before you start (one time)

1. Install the Supabase CLI and Docker Desktop. `supabase db dump` runs `pg_dump` inside Docker, so Docker must be running.
2. Install the Postgres client tools for `psql`: `brew install libpq`, then follow its note to add it to your PATH.
3. Link this repo to the production project. The project ref is in the Supabase dashboard URL.

   ```bash
   supabase link --project-ref <prod-project-ref>
   ```

4. Keep backups out of git. They contain names and emails.

   ```bash
   echo "backups/" >> .gitignore
   ```

## 1. Take a backup

Run these from the repo root. Each dump goes in a folder named after the current time.

```bash
export B=backups/$(date +%Y-%m-%d_%H%M)
mkdir -p "$B"
supabase db dump --linked --role-only -f "$B/roles.sql"
supabase db dump --linked -f "$B/schema.sql"
supabase db dump --linked --data-only --use-copy -f "$B/data.sql"
```

The data dump includes the `auth` schema, so logins are kept. The app has no Storage files, so nothing else needs saving.

## 2. Check the backup

Make sure every file has content and the data looks right.

```bash
ls -lh "$B"
grep -c "^COPY" "$B/data.sql"
grep -n "COPY public.medlem " "$B/data.sql"
```

`grep -c` should print a number well above zero. The last line should find the `medlem` table.

Copy the folder somewhere off your laptop too, for example an encrypted cloud drive.

## 3. Deploy

1. See which migrations will run, without running them.

   ```bash
   supabase db push --dry-run
   ```

2. Only the new migrations from the ticket should be listed. If you see anything else, stop.
3. Push the migrations.

   ```bash
   supabase db push
   ```

4. Deploy the frontend after the database: merge to `main` and let Vercel build. Additive migrations work with the old frontend, so this order is always safe.
5. Open the app on your phone. Check that the home screen, Giv bøde and Saldo still work.

## 4. Roll back

Pick the smallest fix that solves the problem.

### A. The frontend is broken, the data is fine

In Vercel, open **Deployments**. Find the last good deployment, open its **⋯** menu and choose **Promote to Production** (instant rollback). The database stays as it is. Additive migrations don't hurt the old frontend.

### B. A new feature misbehaves

Every new rule starts switched off. Switch it off again in **Indstillinger**, then annul any wrong Gebyrer. You don't need to restore anything.

### C. The data is damaged: full restore

Use this only when data is really lost or corrupted. Anything written after the backup is lost.

Restore into a **fresh** project rather than wiping production. The broken project then stays as evidence.

1. First dump the broken state, so you can copy over anything written after the backup.

   ```bash
   export BROKEN=backups/broken-$(date +%Y-%m-%d_%H%M)
   mkdir -p "$BROKEN"
   supabase db dump --linked --data-only --use-copy -f "$BROKEN/data.sql"
   ```

2. Create a new Supabase project. Free allows two, so you may need to delete or pause staging first.
3. Copy its connection string: **Connect → Session pooler**. Then restore the backup into it.

   ```bash
   psql --single-transaction --variable ON_ERROR_STOP=1 \
     --file "$B/roles.sql" \
     --file "$B/schema.sql" \
     --command 'SET session_replication_role = replica' \
     --file "$B/data.sql" \
     --dbname "<new-project-connection-string>"
   ```

4. In the new project, redo the dashboard settings that live outside the database:
   - Auth site URL and redirect URLs
   - Email templates and SMTP
   - Edge Function secrets, such as the VAPID key once push exists
   - Enabled extensions, such as `pg_cron` and `pg_net`, if `schema.sql` didn't enable them
5. In Vercel, set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` to the new project, then redeploy.
6. Everyone must sign in again, because the new project has new auth keys. Tell the group.
7. Relink the CLI to the new project: `supabase link --project-ref <new-ref>`.

## Practise once

Do a full restore (step C) into the staging project once, before you need it for real. A backup you have never restored is only a hope.
