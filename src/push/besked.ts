// Shared by the service worker (src/sw.ts) and its tests: no DOM, no window.

/** A push as the sender (supabase/functions/send-push) sends it. */
export interface PushBesked {
  titel: string;
  tekst: string;
  /** In-app path with `?bodekasse=<id>`. */
  url: string;
}

/**
 * Reads a push payload. Never fails: iOS revokes push permission when a push
 * shows no notification, so anything unreadable still becomes one.
 */
export function laesPushBesked(tekst: string | null): PushBesked {
  try {
    const data: unknown = JSON.parse(tekst ?? '');
    if (data && typeof data === 'object') {
      const { titel, tekst: brod, url } = data as Record<string, unknown>;
      return {
        titel: typeof titel === 'string' && titel ? titel : 'Bødekasse',
        tekst: typeof brod === 'string' ? brod : '',
        url: typeof url === 'string' ? url : '/',
      };
    }
  } catch {
    // Not JSON: show the raw text.
  }
  return { titel: 'Bødekasse', tekst: tekst ?? '', url: '/' };
}

/** The absolute address a tap opens: the push's path in this app, never elsewhere. */
export function pushMaal(url: string, origin: string): string {
  const maal = new URL(url, origin);
  return maal.origin === origin ? maal.href : new URL('/', origin).href;
}
