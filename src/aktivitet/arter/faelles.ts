import { formatKr, t } from '../../strings/index.ts';
import type { Gebyr, Haendelse } from '../haendelse.ts';

/** A text field from the entry's data snapshot ('' when missing). */
export const dataTekst = (h: Haendelse, felt: string): string => {
  const v = h.data[felt];
  return typeof v === 'string' ? v : '';
};

/** A number field from the entry's data snapshot (0 when missing). */
export const dataTal = (h: Haendelse, felt: string): number => {
  const v = h.data[felt];
  return typeof v === 'number' ? v : 0;
};

/**
 * The Gebyr an Admin can annul on its own from a row (#62): a creation or
 * Anke Gebyr that still stands. The other kinds go with their cause.
 * Set it as the row's `annullerGebyr`.
 */
export function annullerbartGebyr(gebyrer: readonly Gebyr[]): Gebyr | undefined {
  return gebyrer.find((g) => (g.art === 'oprettelse' || g.art === 'anke') && !g.annullering);
}

/**
 * The small text under a row's amount for the Gebyrer its cause charged:
 * "+25 kr gebyr" for those not annulled, "Gebyr annulleret" when every one
 * was annulled, nothing when there are none.
 */
export function gebyrTekst(gebyrer: readonly Gebyr[]): string | undefined {
  if (gebyrer.length === 0) return undefined;
  const beloeb = gebyrer.filter((g) => !g.annullering).reduce((s, g) => s + g.beloeb, 0);
  if (beloeb > 0) return t('aktivitet.plusGebyr', { beloeb: formatKr(beloeb) });
  return gebyrer.every((g) => g.annullering) ? t('aktivitet.gebyrAnnulleret') : undefined;
}
