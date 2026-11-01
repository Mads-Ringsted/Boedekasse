import { saveLastUsed } from '../bodekasse/lastUsed.ts';
import { laesPushLink } from './pushLink.ts';

/**
 * Opened from a push (`/profil?bodekasse=<id>`): remember that box so the app
 * opens it, and drop the parameter from the address. Call it before the
 * router reads the address.
 */
export function foelgPushLink(): void {
  const link = laesPushLink(window.location.search);
  if (!link) return;
  saveLastUsed(link.bodekasseId);
  window.history.replaceState(null, '', window.location.pathname + link.search + window.location.hash);
}

/**
 * A push tapped while the app is open: the service worker focuses the app and
 * posts `AABN_PUSH`. Reloading at the push's address goes through
 * `foelgPushLink`, which also switches box.
 */
export function lytEfterPushTryk(): void {
  const sw = navigator.serviceWorker as ServiceWorkerContainer | undefined;
  if (!sw) return;
  sw.addEventListener('message', (event: MessageEvent) => {
    const data = event.data as { type?: unknown; url?: unknown } | null;
    if (data?.type !== 'AABN_PUSH' || typeof data.url !== 'string') return;
    const maal = new URL(data.url, window.location.origin);
    if (maal.origin === window.location.origin) window.location.assign(maal.href);
  });
  sw.startMessages();
}
