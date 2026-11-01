import { isInstalled, readDisplayEnv } from '../shell/installed.ts';
import { supabase } from '../supabase/index.ts';
import { base64UrlTilBytes, type EnhedPush } from './push.ts';

/** The public VAPID key (see docs/ops/push-setup.md). Empty: push is off in this build. */
const VAPID_NOEGLE = ((import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) ?? '').trim();

export interface Enhed extends EnhedPush {
  /** The app's service worker registration; null in dev (no service worker) or unsupported. */
  registrering: ServiceWorkerRegistration | null;
  abonnement: PushSubscription | null;
}

function harWebPush(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/** What this device can do about push, and its current subscription. */
export async function laesEnhed(): Promise<Enhed> {
  const installeret = isInstalled(readDisplayEnv());
  const registrering = harWebPush() ? ((await navigator.serviceWorker.getRegistration()) ?? null) : null;
  const abonnement = registrering ? await registrering.pushManager.getSubscription() : null;
  return {
    installeret,
    understoettet: registrering !== null,
    harNoegle: VAPID_NOEGLE !== '',
    tilladelse: harWebPush() ? Notification.permission : 'default',
    abonneret: abonnement !== null,
    registrering,
    abonnement,
  };
}

/** Tells the server about this device, for the logged-in person. */
export async function gemAbonnement(abonnement: PushSubscription): Promise<void> {
  const { endpoint, keys } = abonnement.toJSON();
  const { error } = await supabase.rpc('abonner_push', {
    p_endpoint: endpoint ?? '',
    p_p256dh: keys?.p256dh ?? '',
    p_auth: keys?.auth ?? '',
  });
  if (error) throw error;
}

/**
 * "Slå notifikationer til". Call it straight from the tap: iOS asks for
 * permission only during a user gesture. Returns the new permission.
 */
export async function slaaTil(registrering: ServiceWorkerRegistration): Promise<NotificationPermission> {
  // subscribe() first, with no await before it: it asks for permission, and
  // it returns the existing subscription if there is one.
  const abonnement = await registrering.pushManager
    .subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlTilBytes(VAPID_NOEGLE) })
    .catch((error: unknown) => {
      // Said no or closed the prompt: not an error. Allowed but failed: it is.
      if (Notification.permission === 'granted') throw error;
      return null;
    });
  if (!abonnement) return Notification.permission;
  await gemAbonnement(abonnement);
  return 'granted';
}

/** Stops pushes to this device: forgets it on the server, then unsubscribes. */
export async function slaaFra(abonnement: PushSubscription): Promise<void> {
  const { error } = await supabase.rpc('afmeld_push', { p_endpoint: abonnement.endpoint });
  if (error) throw error;
  await abonnement.unsubscribe();
}

/**
 * On Log ud: the next person on this device must opt in themselves. Best
 * effort; offline, the push service soon reports the endpoint gone.
 */
export async function afmeldVedLogUd(): Promise<void> {
  try {
    if (!harWebPush()) return;
    const abonnement = await (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription();
    if (!abonnement) return;
    await supabase.rpc('afmeld_push', { p_endpoint: abonnement.endpoint });
    await abonnement.unsubscribe();
  } catch {
    // Never block Log ud.
  }
}
