import type { Gebyr } from './haendelse.ts';
import type { Raekke } from './visning.ts';

/** What tapping a (non-batch) feed row opens. */
export type Tryk =
  | { art: 'boede'; boedeId: string }
  | { art: 'gebyr'; gebyr: Gebyr }
  | { art: 'link'; link: string };

/**
 * A Bøde row always opens the Bøde detail (an Anke Gebyr is annulled from
 * there). A row with only a Gebyr to annul opens "Annullér gebyr" for an
 * Admin. Otherwise the row's link, or nothing.
 */
export function trykPaaRaekke(r: Raekke, kanAnnullereGebyr: boolean): Tryk | null {
  if (r.boedeId) return { art: 'boede', boedeId: r.boedeId };
  if (r.annullerGebyr && kanAnnullereGebyr) return { art: 'gebyr', gebyr: r.annullerGebyr };
  if (r.link) return { art: 'link', link: r.link };
  return null;
}
