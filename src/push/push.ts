import type { Enums } from '../supabase/index.ts';

/** One kind of push; each is one toggle in Profil. Matches `public.push_art`. */
export type PushArt = Enums<'push_art'>;

/** Every kind, in the order Profil lists the toggles. */
export const PUSH_ARTER: readonly PushArt[] = [
  'bode_modtaget',
  'anke_afstemning',
  'anke_resultat',
  'betalingsmelding_venter',
  'betaling_bekraeftet',
  'automatisk_gebyr',
  'betalingspaamindelse',
];

/** The person's toggles. Missing ones (no row stored yet) are on. */
export function praeferencer(gemt: Partial<Record<PushArt, boolean>> | null): Record<PushArt, boolean> {
  return Object.fromEntries(PUSH_ARTER.map((art) => [art, gemt?.[art] ?? true])) as Record<PushArt, boolean>;
}

/** What this device can do about push right now. */
export interface EnhedPush {
  /** Opened from the home screen (`isInstalled`). */
  installeret: boolean;
  /** A service worker, PushManager and Notification exist. */
  understoettet: boolean;
  /** The app was built with `VITE_VAPID_PUBLIC_KEY`. */
  harNoegle: boolean;
  tilladelse: NotificationPermission;
  /** This device has a push subscription. */
  abonneret: boolean;
}

/**
 * The notifications card on your profile:
 * - `installer`: "Installér appen for at få notifikationer" (a browser tab).
 * - `ikkeUnderstoettet`: this device or build can't do Web Push.
 * - `blokeret`: you said no; allow it in the phone's settings.
 * - `slaaTil`: the "Slå notifikationer til" card.
 * - `til`: subscribed; show the toggles.
 */
export type NotifikationTilstand = 'installer' | 'ikkeUnderstoettet' | 'blokeret' | 'slaaTil' | 'til';

export function notifikationTilstand(enhed: EnhedPush): NotifikationTilstand {
  if (!enhed.installeret) return 'installer';
  if (!enhed.understoettet || !enhed.harNoegle) return 'ikkeUnderstoettet';
  if (enhed.tilladelse === 'denied') return 'blokeret';
  if (enhed.tilladelse === 'granted' && enhed.abonneret) return 'til';
  return 'slaaTil';
}

/** A base64url string (the VAPID public key) as bytes for `applicationServerKey`. */
export function base64UrlTilBytes(tekst: string): Uint8Array<ArrayBuffer> {
  const base64 = tekst.replace(/-/g, '+').replace(/_/g, '/');
  const binaer = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binaer, (tegn) => tegn.charCodeAt(0));
}
