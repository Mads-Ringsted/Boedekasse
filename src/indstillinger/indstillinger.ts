import type { Tables } from '../supabase/database.types.ts';

/** A box's settings: the columns of `bodekasse` (box name included). */
export type Indstillinger = Tables<'bodekasse'>;

/**
 * What `opdater_indstillinger` takes: any settings, only the ones that change.
 * The server decides which keys are settings (`private.indstilling`); a new
 * rule needs no change here once `db:types` knows its column.
 */
export type IndstillingAendringer = Partial<Omit<Indstillinger, 'id' | 'oprettet'>>;

/**
 * The creation Gebyr the next new Bødekategori costs, or null when it is free
 * (the rule is off, or a Pause: no Sæson runs).
 */
export function gebyrVedOprettelse(
  indstillinger: Pick<Indstillinger, 'oprettelsesgebyr_til' | 'oprettelsesgebyr'>,
  pause: boolean,
): number | null {
  return indstillinger.oprettelsesgebyr_til && !pause ? indstillinger.oprettelsesgebyr : null;
}

/**
 * The MobilePay Box number as stored: trimmed with single spaces, digits and
 * spaces only, at most 20 characters. Empty means no number. Mirrors the
 * server's `private.indstilling_mobilepay`.
 */
export function rensMobilePay(input: string): { ok: true; vaerdi: string | null } | { ok: false } {
  const nr = input.trim().replace(/\s+/g, ' ');
  if (nr === '') return { ok: true, vaerdi: null };
  if (!/^[0-9]+( [0-9]+)*$/.test(nr) || nr.length > 20) return { ok: false };
  return { ok: true, vaerdi: nr };
}
