/** The first name: the first word of a full name. */
export const fornavn = (navn: string): string => navn.trim().split(/\s+/)[0] ?? '';

/**
 * Short names for a list of people, in the same order: the first name, or
 * the full name when someone else in the list has the same first name.
 */
export function kortNavne(navne: readonly string[]): string[] {
  const antal = new Map<string, number>();
  for (const n of navne) {
    const noegle = fornavn(n).toLocaleLowerCase('da');
    antal.set(noegle, (antal.get(noegle) ?? 0) + 1);
  }
  return navne.map((n) => ((antal.get(fornavn(n).toLocaleLowerCase('da')) ?? 0) > 1 ? n.trim() : fornavn(n)));
}
