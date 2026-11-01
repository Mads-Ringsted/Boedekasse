// send-push (#81): sends the push outbox (public.push_udbakke) with Web Push.
//
// Woken by the database (private.skub_push via pg_net) after new pushes and by
// the 30-second sweep. It claims due rows, sends each to every device of its
// login, marks the row sent (at least one device took it) or failed, and
// deletes subscriptions the push service calls gone (404 / 410).
//
// Secrets (supabase secrets set ...), see docs/ops/push-setup.md:
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT  the VAPID key pair and contact
//   PUSH_SEND_SECRET  shared with Vault 'push_send_secret'; callers send it as a Bearer token
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
//
// Deployed with verify_jwt = false (supabase/config.toml): the shared secret
// is the check. No unit tests; checked by hand on a real phone (spec #74).

import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

interface Abonnement {
  endpoint: string;
  p256dh: string;
  auth: string;
}

interface Raekke {
  id: number;
  titel: string;
  tekst: string;
  url: string;
  abonnementer: Abonnement[];
}

const MAKS_RUNDER = 10; // 10 × 50 rows per wake-up; the sweep takes the rest
const RUNDE = 50;

function env(navn: string): string {
  const vaerdi = Deno.env.get(navn);
  if (!vaerdi) throw new Error(`${navn} mangler`);
  return vaerdi;
}

Deno.serve(async (req) => {
  const hemmelighed = Deno.env.get('PUSH_SEND_SECRET');
  if (!hemmelighed || req.headers.get('Authorization') !== `Bearer ${hemmelighed}`) {
    return new Response('ikke tilladt', { status: 401 });
  }

  webpush.setVapidDetails(env('VAPID_SUBJECT'), env('VAPID_PUBLIC_KEY'), env('VAPID_PRIVATE_KEY'));
  const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let sendt = 0;
  let fejlet = 0;
  for (let runde = 0; runde < MAKS_RUNDER; runde++) {
    const { data, error } = await db.rpc('push_hent_klar', { p_max: RUNDE });
    if (error) return Response.json({ fejl: error.message }, { status: 500 });
    const raekker = (data ?? []) as Raekke[];
    if (raekker.length === 0) break;

    await Promise.all(
      raekker.map(async (raekke) => {
        const fejl = await send(db, raekke);
        await db.rpc('push_marker', { p_id: raekke.id, p_fejl: fejl });
        if (fejl === null) sendt++;
        else fejlet++;
      }),
    );
    if (raekker.length < RUNDE) break;
  }

  return Response.json({ sendt, fejlet });
});

/** Sends one row to all its devices. Null when at least one took it, else why not. */
async function send(db: ReturnType<typeof createClient>, raekke: Raekke): Promise<string | null> {
  if (raekke.abonnementer.length === 0) return 'ingen_abonnement';
  const payload = JSON.stringify({ titel: raekke.titel, tekst: raekke.tekst, url: raekke.url });
  const svar = await Promise.all(
    raekke.abonnementer.map(async (a) => {
      try {
        await webpush.sendNotification(
          { endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } },
          payload,
          { TTL: 60 * 60 * 24, urgency: 'normal' },
        );
        return null;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await db.rpc('push_fjern_abonnement', { p_endpoint: a.endpoint });
        }
        return status ? `${status}` : String((e as Error).message ?? e);
      }
    }),
  );
  return svar.some((s) => s === null) ? null : svar.join(', ');
}
