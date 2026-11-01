// ryd-billeder (#104): deletes Profilbillede files queued in the cleanup
// outbox (public.billede_oprydning).
//
// Woken by the database (private.skub_billede_oprydning via pg_net) at the end
// of the hourly automation run, when paths are due. It claims due rows,
// deletes their files from the profilbilleder bucket through the Storage API
// and marks the rows done. Idempotent: a path that is already gone counts as
// deleted, and a done row is never handed out again. On a Storage error the
// rows keep the error and are retried by a later run (at most 10 tries).
//
// Secret (supabase secrets set ...), see docs/ops/billede-oprydning-setup.md:
//   RYD_BILLEDER_SECRET  shared with Vault 'ryd_billeder_secret'; callers send it as a Bearer token
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
//
// Deployed with verify_jwt = false (supabase/config.toml): the shared secret
// is the check. No unit tests; checked by hand once on staging (spec #99).

import { createClient } from 'npm:@supabase/supabase-js@2';

const BUCKET = 'profilbilleder';
const MAKS_RUNDER = 10; // 10 × 100 paths per wake-up; the next hourly run takes the rest
const RUNDE = 100;

interface Raekke {
  id: number;
  sti: string;
}

function env(navn: string): string {
  const vaerdi = Deno.env.get(navn);
  if (!vaerdi) throw new Error(`${navn} mangler`);
  return vaerdi;
}

Deno.serve(async (req) => {
  const hemmelighed = Deno.env.get('RYD_BILLEDER_SECRET');
  if (!hemmelighed || req.headers.get('Authorization') !== `Bearer ${hemmelighed}`) {
    return new Response('ikke tilladt', { status: 401 });
  }

  const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let slettet = 0;
  let fejlet = 0;
  for (let runde = 0; runde < MAKS_RUNDER; runde++) {
    const { data, error } = await db.rpc('billede_oprydning_hent_klar', { p_max: RUNDE });
    if (error) return Response.json({ fejl: error.message }, { status: 500 });
    const raekker = (data ?? []) as Raekke[];
    if (raekker.length === 0) break;

    // remove() skips paths that don't exist, so a repeat is harmless.
    const { error: sletFejl } = await db.storage.from(BUCKET).remove(raekker.map((r) => r.sti));
    const ids = raekker.map((r) => r.id);
    const { error: markerFejl } = await db.rpc('billede_oprydning_marker', {
      p_ids: ids,
      p_fejl: sletFejl ? sletFejl.message || 'storage_fejl' : null,
    });
    if (markerFejl) return Response.json({ fejl: markerFejl.message }, { status: 500 });
    if (sletFejl) {
      fejlet += ids.length;
      break; // Storage is unhappy; the claims expire and a later run retries
    }
    slettet += ids.length;
    if (raekker.length < RUNDE) break;
  }

  return Response.json({ slettet, fejlet });
});
