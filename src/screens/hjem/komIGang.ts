export type KomIGangTrin = 'opret' | 'inviter' | 'kategorier' | 'boede';

export interface KomIGangPunkt {
  trin: KomIGangTrin;
  /** `naeste` is the first step not done yet; it gets the blue number. */
  status: 'gjort' | 'naeste' | 'senere';
}

export interface BoxTal {
  /** Active Medlemmer, the caller included. */
  antalMedlemmer: number;
  antalBodekategorier: number;
  /** Bøder ever given in the box, any Sæson. */
  antalBoeder: number;
}

/**
 * The "Kom i gang" checklist on Hjem, or null once the first Bøde is given
 * (then Hjem shows its normal content).
 */
export function komIGang({ antalMedlemmer, antalBodekategorier, antalBoeder }: BoxTal): KomIGangPunkt[] | null {
  if (antalBoeder > 0) return null;
  const gjort: Array<[KomIGangTrin, boolean]> = [
    ['opret', true],
    ['inviter', antalMedlemmer > 1],
    ['kategorier', antalBodekategorier > 0],
    ['boede', false],
  ];
  const naeste = gjort.findIndex(([, done]) => !done);
  return gjort.map(([trin, done], i) => ({
    trin,
    status: done ? 'gjort' : i === naeste ? 'naeste' : 'senere',
  }));
}
