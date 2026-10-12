/**
 * The Giv bøder selection: who is picked, and how many of each Bødekategori
 * each of them gets. Pure and immutable; the screens hold it in state.
 *
 * Two layers:
 * - `faelles`: the counts set in step 2 (Hvad), meant for everyone picked.
 * - `antal`: what each picked person actually gets. Step 2 changes it for
 *   everyone at once; step 3b ("Tilpas pr. person") changes one person.
 * A person picked later starts with the `faelles` counts.
 *
 * `Regler.kanFaa` says whether a person may get a Bødekategori at all.
 * Every change for "everyone" skips the pairs it rejects (#65: Frikøb).
 *
 * Engangsbøder (#58) follow the same two layers: `faellesEngangs` (added in
 * step 2) and `engangs` per person. Frikøb never covers them, so `Regler`
 * doesn't apply to them.
 */
export interface Valg {
  /** Picked people (Medlem ids), in the order they were picked. */
  readonly personer: readonly string[];
  /** Step 2 counts per Bødekategori id. */
  readonly faelles: Readonly<Record<string, number>>;
  /** Per person id: count per Bødekategori id. Only picked people have an entry. */
  readonly antal: Readonly<Record<string, Readonly<Record<string, number>>>>;
  /** Step 2 Engangsbøder, meant for everyone picked. */
  readonly faellesEngangs: readonly Engangsbode[];
  /** Per person id: the Engangsbøder they get. Only picked people have an entry. */
  readonly engangs: Readonly<Record<string, readonly Engangsbode[]>>;
}

/** One Engangsbøde in the selection. `id` is local; the same id for everyone it was added to. */
export interface Engangsbode {
  id: string;
  grund: string;
  beloeb: number;
}

export interface Regler {
  /** False when this person must not get this Bødekategori (e.g. a Frikøb). */
  kanFaa(personId: string, kategoriId: string): boolean;
}

/** Everyone may get everything. */
export const INGEN_REGLER: Regler = { kanFaa: () => true };

/** The most of one Bødekategori one person can get in one go (the RPC's limit). */
export const MAKS_ANTAL = 99;

/** What the summary needs to know about a Bødekategori. */
export interface PrisKategori {
  id: string;
  navn: string;
  pris: number;
}

export interface Linje {
  /** The Bødekategori id, or the Engangsbøde's local id. */
  kategoriId: string;
  /** An Engangsbøde: `navn` is its reason, `antal` is 1. */
  engangs: boolean;
  navn: string;
  pris: number;
  antal: number;
  beloeb: number;
}

export interface PersonSum {
  id: string;
  /** In the order of the Bødekategorier passed to `opsummer`, then the Engangsbøder. */
  linjer: Linje[];
  antal: number;
  beloeb: number;
}

export interface Opsummering {
  /** Every picked person, also one with no Bøder yet. */
  personer: PersonSum[];
  antal: number;
  beloeb: number;
  /** How many of the Bøder are Engangsbøder (each costs the giver its Gebyr). */
  engangsboeder: number;
  /** When everyone gets exactly the same: what each one gets. Else null. */
  hver: { antal: number; beloeb: number } | null;
}

/** One line of the `giv_boeder` RPC's `p_linjer`: Bødekategori × count, or one Engangsbøde. */
export type GivLinje =
  | { modtager_id: string; bodekategori_id: string; antal: number }
  | { modtager_id: string; grund: string; beloeb: number };

const klem = (n: number) => Math.max(0, Math.min(MAKS_ANTAL, n));

/** Removes zero counts so "nothing" has one shape. */
function udenNuller(taelling: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.entries(taelling).filter(([, n]) => n > 0));
}

function startFor(personId: string, faelles: Valg['faelles'], regler: Regler): Record<string, number> {
  return udenNuller(
    Object.fromEntries(Object.entries(faelles).map(([k, n]) => [k, regler.kanFaa(personId, k) ? n : 0])),
  );
}

/**
 * A fresh selection. `personer` pre-picks people (Giv bøde on a profile);
 * `kategoriId` pre-adds one of that Bødekategori (Giv denne bøde).
 */
export function nytValg(
  { personer = [], kategoriId }: { personer?: readonly string[]; kategoriId?: string } = {},
  regler: Regler = INGEN_REGLER,
): Valg {
  const faelles = kategoriId ? { [kategoriId]: 1 } : {};
  return {
    personer: [...personer],
    faelles,
    antal: Object.fromEntries(personer.map((p) => [p, startFor(p, faelles, regler)])),
    faellesEngangs: [],
    engangs: Object.fromEntries(personer.map((p) => [p, []])),
  };
}

export function erValgt(valg: Valg, personId: string): boolean {
  return valg.personer.includes(personId);
}

/** Picks or un-picks one person. Un-picking drops what they had. */
export function skiftPerson(valg: Valg, personId: string, regler: Regler = INGEN_REGLER): Valg {
  if (erValgt(valg, personId)) {
    const { [personId]: _fjernet, ...antal } = valg.antal;
    const { [personId]: _fjernetEngangs, ...engangs } = valg.engangs;
    return { ...valg, personer: valg.personer.filter((p) => p !== personId), antal, engangs };
  }
  return {
    ...valg,
    personer: [...valg.personer, personId],
    antal: { ...valg.antal, [personId]: startFor(personId, valg.faelles, regler) },
    engangs: { ...valg.engangs, [personId]: valg.faellesEngangs },
  };
}

/** Picks everyone in `personIds` who isn't picked yet, in that order. */
export function vaelgAlle(valg: Valg, personIds: readonly string[], regler: Regler = INGEN_REGLER): Valg {
  return personIds.reduce((v, p) => (erValgt(v, p) ? v : skiftPerson(v, p, regler)), valg);
}

/** Un-picks everyone. */
export function fravaelgAlle(valg: Valg): Valg {
  return { ...valg, personer: [], antal: {}, engangs: {} };
}

/** Step 2's count for a Bødekategori (what its stepper shows). */
export function faellesAntal(valg: Valg, kategoriId: string): number {
  return valg.faelles[kategoriId] ?? 0;
}

/** How many of a Bødekategori one person gets. */
export function antalFor(valg: Valg, personId: string, kategoriId: string): number {
  return valg.antal[personId]?.[kategoriId] ?? 0;
}

/** The picked people who can get this Bødekategori ("Gives kun til …"). */
export function modtagereAf(valg: Valg, kategoriId: string, regler: Regler = INGEN_REGLER): string[] {
  return valg.personer.filter((p) => regler.kanFaa(p, kategoriId));
}

function skiftAlle(valg: Valg, kategoriId: string, delta: 1 | -1, regler: Regler): Valg {
  const faelles = udenNuller({ ...valg.faelles, [kategoriId]: klem(faellesAntal(valg, kategoriId) + delta) });
  const antal = Object.fromEntries(
    valg.personer.map((p) => {
      const nu = antalFor(valg, p, kategoriId);
      const ny = delta > 0 && !regler.kanFaa(p, kategoriId) ? nu : klem(nu + delta);
      return [p, udenNuller({ ...valg.antal[p], [kategoriId]: ny })];
    }),
  );
  return { ...valg, faelles, antal };
}

/** Step 2 "+": one more of this Bødekategori to everyone picked who can get it. */
export function plusAlle(valg: Valg, kategoriId: string, regler: Regler = INGEN_REGLER): Valg {
  return skiftAlle(valg, kategoriId, 1, regler);
}

/** Step 2 "−": one fewer for everyone picked who has any. */
export function minusAlle(valg: Valg, kategoriId: string): Valg {
  return skiftAlle(valg, kategoriId, -1, INGEN_REGLER);
}

function skiftEn(valg: Valg, personId: string, kategoriId: string, delta: 1 | -1): Valg {
  if (!erValgt(valg, personId)) return valg;
  const ny = klem(antalFor(valg, personId, kategoriId) + delta);
  return { ...valg, antal: { ...valg.antal, [personId]: udenNuller({ ...valg.antal[personId], [kategoriId]: ny }) } };
}

/** Step 3b "+": one more for this person only. */
export function plusPerson(valg: Valg, personId: string, kategoriId: string, regler: Regler = INGEN_REGLER): Valg {
  return regler.kanFaa(personId, kategoriId) ? skiftEn(valg, personId, kategoriId, 1) : valg;
}

/** Step 3b "−": one fewer for this person only. */
export function minusPerson(valg: Valg, personId: string, kategoriId: string): Valg {
  return skiftEn(valg, personId, kategoriId, -1);
}

/** The Engangsbøder one person gets. */
export function engangsFor(valg: Valg, personId: string): readonly Engangsbode[] {
  return valg.engangs[personId] ?? [];
}

/** Step 2 Engangsbøde: one to everyone picked (and to anyone picked later). */
export function tilfoejEngangsAlle(valg: Valg, engangsbode: Engangsbode): Valg {
  return {
    ...valg,
    faellesEngangs: [...valg.faellesEngangs, engangsbode],
    engangs: Object.fromEntries(valg.personer.map((p) => [p, [...engangsFor(valg, p), engangsbode]])),
  };
}

/** Step 2 remove: takes this Engangsbøde off everyone. */
export function fjernEngangsAlle(valg: Valg, id: string): Valg {
  return {
    ...valg,
    faellesEngangs: valg.faellesEngangs.filter((e) => e.id !== id),
    engangs: Object.fromEntries(valg.personer.map((p) => [p, engangsFor(valg, p).filter((e) => e.id !== id)])),
  };
}

/** Step 3b Engangsbøde: for this person only. */
export function tilfoejEngangsPerson(valg: Valg, personId: string, engangsbode: Engangsbode): Valg {
  if (!erValgt(valg, personId)) return valg;
  return { ...valg, engangs: { ...valg.engangs, [personId]: [...engangsFor(valg, personId), engangsbode] } };
}

/** Step 3b remove: takes this Engangsbøde off this person only. */
export function fjernEngangsPerson(valg: Valg, personId: string, id: string): Valg {
  if (!erValgt(valg, personId)) return valg;
  return {
    ...valg,
    engangs: { ...valg.engangs, [personId]: engangsFor(valg, personId).filter((e) => e.id !== id) },
  };
}

/** Totals per person and in all, for the footers, step 3 and the toast. */
export function opsummer(valg: Valg, kategorier: readonly PrisKategori[]): Opsummering {
  const personer = valg.personer.map((id): PersonSum => {
    const linjer = kategorier.flatMap((k): Linje[] => {
      const antal = antalFor(valg, id, k.id);
      return antal > 0
        ? [{ kategoriId: k.id, engangs: false, navn: k.navn, pris: k.pris, antal, beloeb: antal * k.pris }]
        : [];
    });
    for (const e of engangsFor(valg, id)) {
      linjer.push({ kategoriId: e.id, engangs: true, navn: e.grund, pris: e.beloeb, antal: 1, beloeb: e.beloeb });
    }
    return {
      id,
      linjer,
      antal: linjer.reduce((s, l) => s + l.antal, 0),
      beloeb: linjer.reduce((s, l) => s + l.beloeb, 0),
    };
  });
  const noegle = (p: PersonSum) => p.linjer.map((l) => `${l.kategoriId}×${l.antal}`).join(',');
  const ens = personer.length > 0 && personer.every((p) => noegle(p) === noegle(personer[0]));
  return {
    personer,
    antal: personer.reduce((s, p) => s + p.antal, 0),
    beloeb: personer.reduce((s, p) => s + p.beloeb, 0),
    engangsboeder: valg.personer.reduce((s, p) => s + engangsFor(valg, p).length, 0),
    hver: ens ? { antal: personer[0].antal, beloeb: personer[0].beloeb } : null,
  };
}

/** The `p_linjer` for `giv_boeder`: one line per person per Bødekategori, then one per Engangsbøde. */
export function givLinjer(valg: Valg): GivLinje[] {
  return valg.personer.flatMap((p): GivLinje[] => [
    ...Object.entries(valg.antal[p] ?? {}).map(([k, antal]) => ({ modtager_id: p, bodekategori_id: k, antal })),
    ...engangsFor(valg, p).map((e) => ({ modtager_id: p, grund: e.grund, beloeb: e.beloeb })),
  ]);
}
