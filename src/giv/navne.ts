import { t } from '../strings/index.ts';

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

/** A person you can give Bøder to (you included). */
export interface Modtager {
  id: string;
  navn: string;
  /** "Dig" for you; else the first name, or the full name when another Medlem shares it. */
  kortNavn: string;
  /** False for a pre-added Medlem who has not logged in yet (dashed avatar). */
  loggetInd: boolean;
  /** You: you can give yourself a Bøde. */
  egen: boolean;
}

interface MedlemRaekke {
  id: string;
  navn: string;
  user_id: string | null;
  udmeldt: string | null;
}

const dansk = new Intl.Collator('da');

/** The Giv bøder people: you first as "Dig", then every other active Medlem A–Å. */
export function modtagerListe(medlemmer: readonly MedlemRaekke[], migId: string): Modtager[] {
  const aktive = medlemmer.filter((m) => m.udmeldt === null);
  const mig = aktive.filter((m) => m.id === migId);
  const andre = aktive.filter((m) => m.id !== migId).sort((a, b) => dansk.compare(a.navn, b.navn));
  const korte = kortNavne(andre.map((m) => m.navn));
  const modtager = (m: MedlemRaekke, kortNavn: string, egen: boolean): Modtager => ({
    id: m.id,
    navn: m.navn,
    kortNavn,
    loggetInd: m.user_id !== null,
    egen,
  });
  return [
    ...mig.map((m) => modtager(m, t('medlemmer.dig'), true)),
    ...andre.map((m, i) => modtager(m, korte[i], false)),
  ];
}
