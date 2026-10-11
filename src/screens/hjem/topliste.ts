/** One Medlem on the Topliste for a Sæson (from the `topliste` view). */
export interface ToplisteRad {
  medlemId: string;
  navn: string;
  /** Bøder i alt this Sæson (borne Bøder + every Gebyr kind), in kr. */
  boederIAlt: number;
  /** Betalt this Sæson, in kr. */
  indbetalt: number;
  /** Rank by Bøder i alt; ties share a place (1, 2, 2, 4). */
  plads: number;
}

export interface PodieRad extends ToplisteRad {
  /** Podium step: 1 is the tallest, in the middle. */
  trin: 1 | 2 | 3;
}

export interface OpdeltTopliste {
  /** Up to 3, in display order: 2nd, 1st, 3rd. */
  podie: PodieRad[];
  resten: ToplisteRad[];
  /** Nobody has Bøder this Sæson yet. */
  tom: boolean;
}

const dansk = new Intl.Collator('da');

/** Splits the Topliste into the podium (top 3) and the rows below it. */
export function opdelTopliste(rader: readonly ToplisteRad[]): OpdeltTopliste {
  const sorteret = [...rader].sort((a, b) => a.plads - b.plads || dansk.compare(a.navn, b.navn));
  const top = sorteret.slice(0, 3).map((r, i) => ({ ...r, trin: (i + 1) as 1 | 2 | 3 }));
  const [foerste, anden, tredje] = top;
  return {
    podie: [anden, foerste, tredje].filter((r): r is PodieRad => r !== undefined),
    resten: sorteret.slice(3),
    tom: sorteret.every((r) => r.boederIAlt === 0),
  };
}

export type MinStatus = { art: 'mangler' | 'tilGode'; beloeb: number; kanBetale: boolean };

/** Your Saldo as Hjem shows it: what you owe (with Betal), or Til gode. */
export function minStatus(saldo: number): MinStatus {
  if (saldo < 0) return { art: 'tilGode', beloeb: -saldo, kanBetale: false };
  return { art: 'mangler', beloeb: saldo, kanBetale: saldo > 0 };
}
