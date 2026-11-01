import { t } from '../strings/index.ts';
import type { Enums } from '../supabase/index.ts';

/** One kind of push; each is one toggle on the Notifikationer screen. Matches `public.push_art`. */
export type PushArt = Enums<'push_art'>;

/** Every kind, in the order the Notifikationer screen lists the toggles. */
export const PUSH_ARTER: readonly PushArt[] = [
  'bode_modtaget',
  'anke_afstemning',
  'anke_resultat',
  'betalingsmelding_venter',
  'betaling_bekraeftet',
  'automatisk_gebyr',
  'betalingspaamindelse',
  'andres_aktivitet',
];

/** Opt-in kinds: off until the person turns them on (`private.push_til`). */
const OPT_IN: ReadonlySet<PushArt> = new Set(['andres_aktivitet']);

/** The person's toggles. Missing ones (no row stored yet) take their default: on, except opt-in kinds. */
export function praeferencer(gemt: Partial<Record<PushArt, boolean>> | null): Record<PushArt, boolean> {
  return Object.fromEntries(PUSH_ARTER.map((art) => [art, gemt?.[art] ?? !OPT_IN.has(art)])) as Record<
    PushArt,
    boolean
  >;
}

/**
 * What this device can do about push right now. The app only renders when
 * installed (a browser tab gets the install guide), so that is not a state.
 */
export interface EnhedPush {
  /** A service worker, PushManager and Notification exist. */
  understoettet: boolean;
  /** The app was built with `VITE_VAPID_PUBLIC_KEY`. */
  harNoegle: boolean;
  tilladelse: NotificationPermission;
  /** This device has a push subscription. */
  abonneret: boolean;
}

/**
 * The Notifikationer screen:
 * - `ikkeUnderstoettet`: this device or build can't do Web Push.
 * - `blokeret`: you said no; allow it in the phone's settings.
 * - `slaaTil`: the "Slå notifikationer til" card.
 * - `til`: subscribed; show the toggles.
 */
export type NotifikationTilstand = 'ikkeUnderstoettet' | 'blokeret' | 'slaaTil' | 'til';

export function notifikationTilstand(enhed: EnhedPush): NotifikationTilstand {
  if (!enhed.understoettet || !enhed.harNoegle) return 'ikkeUnderstoettet';
  if (enhed.tilladelse === 'denied') return 'blokeret';
  if (enhed.tilladelse === 'granted' && enhed.abonneret) return 'til';
  return 'slaaTil';
}

/** The "Notifikationer" row on Mere: "Til" while this device is subscribed and any kind is on, else "Fra". */
export function notifikationStatus(enhed: EnhedPush, valg: Record<PushArt, boolean>): string {
  const til = notifikationTilstand(enhed) === 'til' && PUSH_ARTER.some((art) => valg[art]);
  return t(til ? 'notifikationer.til' : 'notifikationer.fra');
}

/** A base64url string (the VAPID public key) as bytes for `applicationServerKey`. */
export function base64UrlTilBytes(tekst: string): Uint8Array<ArrayBuffer> {
  const base64 = tekst.replace(/-/g, '+').replace(/_/g, '/');
  const binaer = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binaer, (tegn) => tegn.charCodeAt(0));
}
