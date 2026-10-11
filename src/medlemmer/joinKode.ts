/** A join code has six letters or digits, e.g. K7P2QX. */
export const JOIN_KODE_LAENGDE = 6;

/** Typed or pasted text as a join code: capitals, letters and digits only, at most six. */
export function rensJoinKode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, JOIN_KODE_LAENGDE);
}
