import type { Boede } from '../haendelse.ts';

/**
 * Whether this person may annul the Bøde (the rule `annuller_bode` enforces):
 * the giver while it has never been appealed, an Admin always; only in the
 * latest Sæson, and only once.
 */
export function kanAnnullereBoede(
  b: Boede,
  mig: { medlemId: string; erAdmin: boolean },
  iSenesteSaeson: boolean,
): boolean {
  if (b.annullering || !iSenesteSaeson) return false;
  if (mig.erAdmin) return true;
  return b.giverId === mig.medlemId && b.ankeId === null;
}
