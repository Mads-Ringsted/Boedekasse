import type { Boede } from '../aktivitet/haendelse.ts';
import { ankeVindue, type AnkeRegler } from '../anke/anke.ts';
import { minMelding, type Melding } from '../betal/betal.ts';

/** What the "Venter på dig" card on your own profile shows. */
export interface VenterPaaDig {
  /** Your own Betalingsmelding that afventer. */
  melding: Melding | null;
  /** Each Bøde you can still appeal, with the time left. */
  anker: { boede: Boede; msTilbage: number }[];
}

/**
 * Your pending Betalingsmelding and the Bøder you can appeal (`hentMeldinger`
 * and `hentKanAnkes`), or null when nothing waits on you: then the card is hidden.
 */
export function venterPaaDig(
  data: { meldinger: readonly Melding[]; migId: string; regler: AnkeRegler; boeder: readonly Boede[] },
  nu: Date = new Date(),
): VenterPaaDig | null {
  const melding = minMelding(data.meldinger, data.migId);
  const anker = data.boeder.flatMap((boede) => {
    const vindue = ankeVindue(boede, data.migId, data.regler, nu);
    return vindue ? [{ boede, msTilbage: vindue.msTilbage }] : [];
  });
  return melding || anker.length > 0 ? { melding, anker } : null;
}
