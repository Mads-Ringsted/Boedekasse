import { t } from '../strings/index.ts';
import { ARTER } from './arter/index.ts';
import type { Haendelse } from './haendelse.ts';
import { hvemObjekt } from './navne.ts';
import type { Beskriver, Kontekst, Raekke } from './visning.ts';

/**
 * What the feed shows for one entry, or null to leave it out (a kind the app
 * doesn't know yet). `arter` is the kind registry; tests may pass their own.
 *
 * When the row the entry is about was annulled, the entry stays in place:
 * greyed, tagged Annulleret, amount struck, "annulleret af X · note".
 */
export function beskrivRaekke(
  h: Haendelse,
  ctx: Kontekst,
  arter: Record<string, Beskriver> = ARTER,
): Raekke | null {
  const beskriv = arter[h.art];
  const raekke = beskriv ? beskriv(h, ctx) : null;
  if (!raekke || !h.annullering) return raekke;

  const { afId, afNavn, note } = h.annullering;
  const linje = [raekke.linje, t('aktivitet.annulleretAf', { navn: hvemObjekt(afId, afNavn, ctx) }), note]
    .filter(Boolean)
    .join(' · ');
  return {
    ...raekke,
    tag: { tekst: t('boede.tag.annulleret'), tone: 'graa' },
    linje,
    annulleret: true,
  };
}
