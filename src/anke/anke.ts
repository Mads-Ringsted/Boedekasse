import type { Boede } from '../aktivitet/haendelse.ts';
import { formatKr, t } from '../strings/index.ts';

const MINUT = 60_000;
const TIME = 60 * MINUT;

/** The box's Anke settings, plus the running Sæson (null = Pause). */
export interface AnkeRegler {
  til: boolean;
  vindueTimer: number;
  min: number;
  maxGange: number;
  aktivSaesonId: string | null;
}

/**
 * Whether `migId` may appeal the Bøde now, and how long is left (the rule
 * `indgiv_anke` enforces): the rule is on, a Sæson runs and the Bøde is from
 * it, you received it, it has never had an Anke, it isn't annulled, and the
 * window since it was given hasn't passed. Null when the Anke is closed.
 */
export function ankeVindue(
  b: Boede,
  migId: string,
  regler: AnkeRegler,
  nu: Date = new Date(),
): { msTilbage: number } | null {
  if (!regler.til || regler.aktivSaesonId === null || b.saesonId !== regler.aktivSaesonId) return null;
  if (b.modtagerId !== migId || b.ankeId !== null || b.annullering) return null;
  const msTilbage = new Date(b.givet).getTime() + regler.vindueTimer * TIME - nu.getTime();
  return msTilbage > 0 ? { msTilbage } : null;
}

/** The range the Anke Gebyr is drawn from, in whole kroner (mirrors `indgiv_anke`). */
export function gebyrInterval(pris: number, regler: Pick<AnkeRegler, 'min' | 'maxGange'>): { min: number; max: number } {
  // Round away float noise first (2.3 × 10 is 22.999… in JS, 23 in Postgres numeric).
  const top = Math.floor(Math.round(regler.maxGange * pris * 1e6) / 1e6);
  return { min: regler.min, max: Math.max(regler.min, top) };
}

/** "19 timer", "1 time", then "45 min" in the last hour. */
export function tilbageTekst(ms: number): string {
  if (ms >= 2 * TIME) return t('anke.timer', { antal: Math.floor(ms / TIME) });
  if (ms >= TIME) return t('anke.enTime');
  return t('anke.minutter', { antal: Math.max(1, Math.floor(ms / MINUT)) });
}

/** An amount without " kr", for the lower end of "mellem 1 og 100 kr". */
export const kronerUdenKr = (n: number): string => formatKr(n).slice(0, -3);
