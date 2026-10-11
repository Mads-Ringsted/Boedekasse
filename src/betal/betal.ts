import { kortDato } from '../kategorier/kategoriListe.ts';
import { t } from '../strings/index.ts';

/** A Betalingsmelding that afventer: someone reported "Jeg har betalt". */
export interface Melding {
  id: string;
  /** The reporter. */
  medlemId: string;
  /** The reporter's short name. */
  navn: string;
  beloeb: number;
  meldt: string;
}

/**
 * The reports I can confirm or reject, oldest first: everyone's but my own,
 * and my own too when I am an Admin.
 */
export function afventerTilMig(meldinger: readonly Melding[], migId: string, erAdmin: boolean): Melding[] {
  return meldinger
    .filter((m) => erAdmin || m.medlemId !== migId)
    .sort((a, b) => (a.meldt < b.meldt ? -1 : a.meldt > b.meldt ? 1 : 0));
}

/** My own report that afventer, if any (there is at most one). */
export function minMelding(meldinger: readonly Melding[], migId: string): Melding | null {
  return meldinger.find((m) => m.medlemId === migId) ?? null;
}

const MINUT = 60_000;
const TIME = 60 * MINUT;

/** "Meldt lige nu", "Meldt for 10 min siden", "Meldt for 3 t siden", "Meldt 8. okt". */
export function meldtTekst(iso: string, nu: Date = new Date()): string {
  const ms = nu.getTime() - new Date(iso).getTime();
  if (ms < MINUT) return t('betal.meldtLigeNu');
  if (ms < TIME) return t('betal.meldtMinutter', { antal: Math.floor(ms / MINUT) });
  if (ms < 24 * TIME) return t('betal.meldtTimer', { antal: Math.floor(ms / TIME) });
  return t('betal.meldtDato', { dato: kortDato(iso, nu) });
}
