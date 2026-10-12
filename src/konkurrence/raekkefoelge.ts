/**
 * The finishing order in Ny Konkurrence: Medlemmer in the order they were
 * tapped. `delt` marks a Medlem who shares the place of the one above (a
 * tie). Pure, so it is tested in Vitest.
 */
export interface Raekkefoelge {
  ids: readonly string[];
  /** Ids that tie with the Medlem just above them. Ignored for the first. */
  delt: ReadonlySet<string>;
}

export const TOM: Raekkefoelge = { ids: [], delt: new Set() };

/** Tap a Medlem: place them next, or take them out again if already placed. */
export function tryk(r: Raekkefoelge, id: string): Raekkefoelge {
  if (r.ids.includes(id)) {
    const delt = new Set(r.delt);
    delt.delete(id);
    return { ids: r.ids.filter((x) => x !== id), delt };
  }
  return { ids: [...r.ids, id], delt: r.delt };
}

/** Toggle "same place as the one above" for a placed Medlem (not the first). */
export function skiftDelt(r: Raekkefoelge, id: string): Raekkefoelge {
  if (r.ids.indexOf(id) <= 0) return r;
  const delt = new Set(r.delt);
  if (delt.has(id)) delt.delete(id);
  else delt.add(id);
  return { ids: r.ids, delt };
}

/** Is this placed Medlem tied with the one above? */
export const erDelt = (r: Raekkefoelge, id: string): boolean => r.ids.indexOf(id) > 0 && r.delt.has(id);

/** Every placed Medlem with their place. Ties share a place and skip the next (1, 2, 2, 4). */
export function pladser(r: Raekkefoelge): { medlemId: string; plads: number }[] {
  let plads = 0;
  return r.ids.map((medlemId, i) => {
    if (!erDelt(r, medlemId)) plads = i + 1;
    return { medlemId, plads };
  });
}

/** What `registrer_konkurrence` / `ret_konkurrence` take: groups sharing a place, in order. */
export function tilGrupper(r: Raekkefoelge): string[][] {
  const grupper: string[][] = [];
  for (const id of r.ids) {
    const sidste = grupper.at(-1);
    if (sidste && erDelt(r, id)) sidste.push(id);
    else grupper.push([id]);
  }
  return grupper;
}

/** A saved result back as a finishing order (to correct it). Absent Medlemmer are left out. */
export function fraResultat(resultat: readonly { medlemId: string; plads: number | null }[]): Raekkefoelge {
  const placeret = resultat
    .filter((r): r is { medlemId: string; plads: number } => r.plads !== null)
    .sort((a, b) => a.plads - b.plads);
  const delt = new Set(placeret.filter((p, i) => i > 0 && placeret[i - 1].plads === p.plads).map((p) => p.medlemId));
  return { ids: placeret.map((p) => p.medlemId), delt };
}

/** The placement Gebyr for a place; places past the table's end pay its last amount. */
export function gebyrForPlads(plads: number, tabel: readonly number[]): number {
  return tabel[Math.min(plads, tabel.length) - 1] ?? 0;
}

/** The footer: how many are placed and absent, and what they pay in all. */
export function opsummer(
  r: Raekkefoelge,
  alle: readonly string[],
  tabel: readonly number[],
  fravaersgebyr: number,
): { placeret: number; fravaerende: number; total: number } {
  const placeret = pladser(r);
  const fravaerende = alle.filter((id) => !r.ids.includes(id)).length;
  const total = placeret.reduce((s, p) => s + gebyrForPlads(p.plads, tabel), 0) + fravaerende * fravaersgebyr;
  return { placeret: placeret.length, fravaerende, total };
}

/**
 * The placement table as typed in Indstillinger: whole kroner separated by
 * commas, slashes or spaces, 1–20 of them. Null when it is not valid.
 * Mirrors the server's `private.indstilling_placeringer`.
 */
export function parsePlaceringer(tekst: string): number[] | null {
  const dele = tekst.split(/[\s,/]+/).filter(Boolean);
  if (dele.length === 0 || dele.length > 20) return null;
  if (!dele.every((d) => /^\d{1,6}$/.test(d))) return null;
  return dele.map(Number);
}

/** "0 / 10 / 25 kr": the table as Indstillinger shows it. */
export const placeringerTekst = (tabel: readonly number[]): string => tabel.join(' / ');
