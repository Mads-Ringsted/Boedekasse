import type { FieldKind, Requirement } from '../components/fieldRules.ts';
import { t } from '../strings/index.ts';
import type { IndstillingAendringer, Indstillinger } from './indstillinger.ts';

/**
 * The rule pattern (#94): a rule row on Indstillinger opens one rule sheet.
 * A `Regel` describes the sheet as data: sections, each with an optional
 * switch and its fields. `RegelSheet` draws it; `udkastResultat` decides
 * what Gem saves. Add a rule by writing a `Regel` (see `regler.ts`).
 */

/** A setting `opdater_indstillinger` takes. */
export type IndstillingNoegle = keyof IndstillingAendringer;

/** A setting that is a switch (`anke_til`, `frikob_til` …). */
export type TilNoegle = {
  [K in IndstillingNoegle]-?: Indstillinger[K] extends boolean ? K : never;
}[IndstillingNoegle];

/** A field's current text, by setting: what was typed, or else the stored value. */
export type Laes = (noegle: IndstillingNoegle) => string;

/** Typed text turned into the value to save, or a Danish error. */
export type Tjekket<V> = { ok: true; vaerdi: V } | { ok: false; fejl: string };

interface FeltFaelles<K extends IndstillingNoegle> {
  /** The setting this field saves. */
  noegle: K;
  /** A function when it depends on another field (the Engangsbøde price's mode). */
  label: string | ((laes: Laes) => string);
  note?: string;
  /** The stored value as the field's starting text. */
  start: (ind: Indstillinger) => string;
  /** Leave out to always show it. A hidden field is neither checked nor saved. */
  vis?: (laes: Laes) => boolean;
}

/** A typed field: an amount, a number or a list. */
export interface TekstFelt<K extends IndstillingNoegle> extends FeltFaelles<K> {
  art: 'tekst';
  /** The keyboard: `integer` for whole numbers, `decimal` when a comma is needed ("1,5", "0, 10, 25"). */
  kind: Extract<FieldKind, 'integer' | 'decimal'>;
  /** Shown after the value, e.g. "kr". */
  enhed?: string;
  tjek: (tekst: string, laes: Laes) => Tjekket<Indstillinger[K]>;
}

/** A pick-one field (radio rows), saved as the chosen value. */
export interface ValgFelt<K extends IndstillingNoegle> extends FeltFaelles<K> {
  art: 'valg';
  valg: readonly { vaerdi: Indstillinger[K] & string; navn: string; under?: string }[];
}

export type Felt = { [K in IndstillingNoegle]: TekstFelt<K> | ValgFelt<K> }[IndstillingNoegle];

/** One part of a rule sheet: a switch first, then its fields. */
export interface Sektion {
  /** A small heading, for sheets with more than one section. */
  titel?: string;
  /** Flips and saves at once; turning it on also saves the section's changed fields (`skiftAendringer`). */
  til?: { noegle: TilNoegle; label: string };
  felter: readonly Felt[];
  /** Under the section's fields. */
  note?: string;
}

/** What a rule row shows: "Til · <resume>" or a muted "Fra". */
export interface RegelStatus {
  til: boolean;
  tekst: string;
}

export interface Regel {
  /** Stable, for keys and state. */
  id: string;
  /** The row's label and the sheet's title. */
  titel: string;
  sektioner: readonly Sektion[];
  /** The row's status; one pure, tested helper per rule. */
  status: (ind: Indstillinger) => RegelStatus;
}

/** What has been typed so far, by setting. Untouched fields are left out. */
export type Udkast = Partial<Record<IndstillingNoegle, string>>;

export interface UdkastResultat {
  /** What Gem saves: only changed, visible, valid fields. */
  aendringer: IndstillingAendringer;
  /** A visible field's error. Any error blocks Gem. */
  fejl: Partial<Record<IndstillingNoegle, string>>;
  /** Some visible field differs from its stored value (the sheet is dirty). */
  aendret: boolean;
  /** What Gem needs, for `primaryAction`: every visible field right, in order. */
  krav: Requirement[];
  /** The fields to draw. */
  synlige: ReadonlySet<IndstillingNoegle>;
  /** Every field's current text. */
  laes: Laes;
}

/** Every field of a rule, in order. */
export function regelFelter(regel: Regel): Felt[] {
  return regel.sektioner.flatMap((s) => s.felter);
}

/**
 * Checks a rule sheet's draft against the stored settings: which fields
 * show, which are wrong and what Gem would save. Fields stay editable while
 * the rule's switch is off.
 */
export function udkastResultat(regel: Regel, ind: Indstillinger, udkast: Udkast): UdkastResultat {
  const felter = regelFelter(regel);
  const start = (noegle: IndstillingNoegle) => felter.find((f) => f.noegle === noegle)?.start(ind) ?? '';
  const laes: Laes = (noegle) => udkast[noegle] ?? start(noegle);

  const aendringer: Record<string, unknown> = {};
  const fejl: Partial<Record<IndstillingNoegle, string>> = {};
  const synlige = new Set<IndstillingNoegle>();
  let aendret = false;

  for (const felt of felter) {
    if (felt.vis && !felt.vis(laes)) continue;
    synlige.add(felt.noegle);
    const tekst = laes(felt.noegle);
    const nyt = tekst !== felt.start(ind);
    if (nyt) aendret = true;
    if (felt.art === 'valg') {
      if (nyt) aendringer[felt.noegle] = tekst;
      continue;
    }
    const tjekket = felt.tjek(tekst, laes);
    if (!tjekket.ok) fejl[felt.noegle] = tjekket.fejl;
    else if (nyt) aendringer[felt.noegle] = tjekket.vaerdi;
  }

  const krav = felter
    .filter((felt) => synlige.has(felt.noegle))
    .map((felt): Requirement => [!fejl[felt.noegle], t('aarsag.retFelt', { felt: feltLabel(felt, laes) })]);
  return { aendringer: aendringer as IndstillingAendringer, fejl, aendret, krav, synlige, laes };
}

/** A field's label; some depend on another field's current text. */
export function feltLabel(felt: Pick<Felt, 'label'>, laes: Laes): string {
  return typeof felt.label === 'function' ? felt.label(laes) : felt.label;
}

/**
 * What flipping a section's switch saves. Turning it on also saves the
 * section's changed fields in the same call, so the rule never goes live
 * with the old values. A wrong changed field keeps the switch off and says
 * which one to fix. Turning it off saves only the switch.
 */
export function skiftAendringer(
  regel: Regel,
  ind: Indstillinger,
  udkast: Udkast,
  noegle: TilNoegle,
  til: boolean,
): Tjekket<IndstillingAendringer> {
  const skift = { [noegle]: til } as IndstillingAendringer;
  if (!til) return { ok: true, vaerdi: skift };
  const resultat = udkastResultat(regel, ind, udkast);
  const aendrede = (regel.sektioner.find((s) => s.til?.noegle === noegle)?.felter ?? []).filter(
    (f) => resultat.synlige.has(f.noegle) && resultat.laes(f.noegle) !== f.start(ind),
  );
  const forkert = aendrede.find((f) => resultat.fejl[f.noegle]);
  if (forkert) return { ok: false, fejl: t('regel.retFoerTil', { felt: feltLabel(forkert, resultat.laes) }) };
  const aendringer = Object.fromEntries(aendrede.map((f) => [f.noegle, resultat.aendringer[f.noegle]]));
  return { ok: true, vaerdi: { ...skift, ...aendringer } };
}
