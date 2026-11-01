import { parsePris } from '../kategorier/kategoriListe.ts';
import type { Enums, Tables } from '../supabase/database.types.ts';

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

/**
 * The Anke max multiple as typed: "2", "1,5" or "1.5", at least 1, at most
 * two decimals (the column is numeric ≥ 1). Null when it isn't one.
 */
export function parseGange(input: string): number | null {
  const tekst = input.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(tekst)) return null;
  const gange = Number(tekst);
  return gange >= 1 && gange <= 1000 ? gange : null;
}

/** The Anke max multiple with a Danish decimal comma: "1,5". */
export function gangeTekst(gange: number): string {
  return String(gange).replace('.', ',');
}

/** The Betalingsdag as typed: a whole day 1–28 (the column's check). Null when it isn't one. */
export function parseBetalingsdag(input: string): number | null {
  const tekst = input.trim();
  if (!/^\d{1,2}$/.test(tekst)) return null;
  const dag = Number(tekst);
  return dag >= 1 && dag <= 28 ? dag : null;
}

/**
 * The optional monthly cap on late fees as typed: empty means no cap,
 * otherwise whole kroner above 0.
 */
export function rensLoft(input: string): { ok: true; vaerdi: number | null } | { ok: false } {
  if (input.trim() === '') return { ok: true, vaerdi: null };
  const loft = parsePris(input);
  return loft === null ? { ok: false } : { ok: true, vaerdi: loft };
}

/** How an Engangsbøde is priced: Fri, Fast or Loft. */
export type EngangsPrisMode = Enums<'engangs_pris_mode'>;

/**
 * The Engangsbøde price as an Admin saves it. Fri needs no amount (the stored
 * one stays for next time); Fast and Loft need whole kroner above 0. Mirrors
 * the server's check on `bodekasse`.
 */
export function tjekEngangsPris(
  mode: EngangsPrisMode,
  tekst: string,
):
  | { ok: true; aendringer: Pick<IndstillingAendringer, 'engangs_pris_mode' | 'engangs_pris'> }
  | { ok: false; fejl: 'mangler' | 'ugyldig' } {
  if (mode === 'fri') return { ok: true, aendringer: { engangs_pris_mode: mode } };
  if (tekst.trim() === '') return { ok: false, fejl: 'mangler' };
  const beloeb = parsePris(tekst);
  if (beloeb === null) return { ok: false, fejl: 'ugyldig' };
  return { ok: true, aendringer: { engangs_pris_mode: mode, engangs_pris: beloeb } };
}
