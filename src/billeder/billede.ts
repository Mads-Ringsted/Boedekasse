/**
 * Profilbilleder: pure rules. No Supabase import, so Vitest can test them.
 * The Storage access rules and RPCs live in
 * supabase/migrations/20261103000000_profilbilleder.sql.
 */

/** The private Storage bucket. */
export const BUCKET = 'profilbilleder';

/** How long a signed URL lives, in seconds. */
export const UDLOEB_SEK = 12 * 60 * 60;

/** Sign a URL again when it has less than this left (ms). */
export const FORNY_MARGIN_MS = 60 * 60 * 1000;

/** The image types the bucket accepts. */
export type BilledType = 'image/webp' | 'image/jpeg' | 'image/png';

const ENDELSE: Record<BilledType, string> = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' };

/**
 * Where a new upload goes: `<bodekasse>/<medlem>/<random>.<ext>`. The folder
 * must be your own active Medlem's (Storage rules and `saet_mit_billede`
 * check it); the random name means a cached URL never shows an old picture.
 */
export function billedSti(bodekasseId: string, medlemId: string, type: BilledType, id: string = crypto.randomUUID()): string {
  return `${bodekasseId}/${medlemId}/${id}.${ENDELSE[type]}`;
}

/**
 * Picture or initials. Initials when there is no URL, for a Medlem who
 * hasn't signed up (dashed style), and when this URL failed to load.
 */
export function visBillede(a: { url?: string; stiplet?: boolean; tidligere?: boolean; fejletUrl?: string }): boolean {
  return Boolean(a.url) && !a.stiplet && a.url !== a.fejletUrl;
}

/** A signed URL and when it expires (ms since epoch). */
export interface SigneretUrl {
  url: string;
  udloeber: number;
}

/** The paths (each once) that have no signed URL yet or one that expires soon. */
export function skalSigneres(stier: Iterable<string>, cache: ReadonlyMap<string, SigneretUrl>, nu: number): string[] {
  const ud = new Set<string>();
  for (const sti of stier) {
    const kendt = cache.get(sti);
    if (!kendt || kendt.udloeber - nu < FORNY_MARGIN_MS) ud.add(sti);
  }
  return [...ud];
}
