import type { Regler } from '../giv/valg.ts';

/** A Frikøb that covers someone now (view `frikob_aktiv`: latest Sæson, not annulled). */
export interface AktivtFrikob {
  id: string;
  medlemId: string;
  medlemNavn: string;
  bodekategoriId: string;
  /** Archived Bødekategorier keep their Frikøb. */
  bodekategoriNavn: string;
  koebt: string;
  /** The Frikøbsgebyr paid. */
  pris: number;
}

/** Giv bøder rules: nobody gets a Bødekategori they have bought out. */
export function frikobRegler(frikoeb: readonly AktivtFrikob[]): Regler {
  const daekket = new Set(frikoeb.map((f) => `${f.medlemId}|${f.bodekategoriId}`));
  return { kanFaa: (personId, kategoriId) => !daekket.has(`${personId}|${kategoriId}`) };
}

/**
 * Step 2's Frikøb line for a Bødekategori: the picked people holding a
 * Frikøb on it ("Oliver har Frikøb") and those who still get it ("Gives kun
 * til Jonas"). Null when none of the picked people holds one.
 */
export function frikobIGiv(
  valgte: readonly { id: string; kortNavn: string }[],
  kategoriId: string,
  regler: Regler,
): { holdere: string[]; modtagere: string[] } | null {
  const holdere = valgte.filter((p) => !regler.kanFaa(p.id, kategoriId)).map((p) => p.kortNavn);
  if (holdere.length === 0) return null;
  return { holdere, modtagere: valgte.filter((p) => regler.kanFaa(p.id, kategoriId)).map((p) => p.kortNavn) };
}

/** A Sæson name inside a sentence: "Sæson 2026" → "sæson 2026". */
export const iSaeson = (navn: string) => navn.charAt(0).toLocaleLowerCase('da') + navn.slice(1);
