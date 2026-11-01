import type { Indstillinger } from '../indstillinger/indstillinger.ts';
import { parsePris } from '../kategorier/kategoriListe.ts';

/**
 * How the box prices an Engangsbøde (#76): Fri (the giver types any amount),
 * Fast (always `beloeb`, nothing to type) or Loft (the giver types up to
 * `loft`). The server enforces the same rule in `giv_engangsbode`.
 */
export type EngangsPris = { mode: 'fri' } | { mode: 'fast'; beloeb: number } | { mode: 'loft'; loft: number };

export function engangsPris(indstillinger: Pick<Indstillinger, 'engangs_pris_mode' | 'engangs_pris'>): EngangsPris {
  const { engangs_pris_mode: mode, engangs_pris: pris } = indstillinger;
  // The server requires an amount for Fast and Loft; without one, fall back to Fri.
  if (mode === 'fast' && pris !== null) return { mode, beloeb: pris };
  if (mode === 'loft' && pris !== null) return { mode, loft: pris };
  return { mode: 'fri' };
}

/** The amount the sheet adds, or null while the field holds no valid one. */
export function engangsBeloeb(pris: EngangsPris, tekst: string): number | null {
  if (pris.mode === 'fast') return pris.beloeb;
  const beloeb = parsePris(tekst);
  if (beloeb === null) return null;
  return pris.mode === 'loft' && beloeb > pris.loft ? null : beloeb;
}

/** Loft: the field refuses a change that would go above the cap. Returns the text to show. */
export function begraensBeloeb(pris: EngangsPris, forrige: string, ny: string): string {
  if (pris.mode !== 'loft') return ny;
  const beloeb = parsePris(ny);
  return beloeb !== null && beloeb > pris.loft ? forrige : ny;
}
