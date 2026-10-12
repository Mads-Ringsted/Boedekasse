import { kortDato, parsePris } from '../kategorier/kategoriListe.ts';
import { t } from '../strings/index.ts';

/** The `indbetaling` columns Kassen needs. */
export interface IndbetalingRaekke {
  id: string;
  saeson_id: string;
  medlem_id: string;
  beloeb: number;
  note: string | null;
  registreret_af: string;
  registreret: string;
  annulleret: string | null;
  annulleret_af: string | null;
  annulleret_note: string | null;
  /** Set when a confirmed Betalingsmelding made it. */
  betalingsmelding_id: string | null;
}

/** The `haevning` columns Kassen needs. */
export interface HaevningRaekke {
  id: string;
  saeson_id: string;
  beloeb: number;
  formaal: string;
  registreret_af: string;
  registreret: string;
  annulleret: string | null;
  annulleret_af: string | null;
  annulleret_note: string | null;
}

interface PostFaelles {
  id: string;
  beloeb: number;
  /** Who registered the Indbetaling, or made the Hævning. */
  registreretAf: string;
  tid: string;
  /** Set when annulled: greyed and struck through. */
  annulleret: { af: string; tid: string; note: string | null } | null;
  /** Admins may annul it: not annulled yet, and in the latest Sæson. */
  kanAnnulleres: boolean;
}

/** An Indbetaling in Kassen's list. */
export interface IndbetalingPost extends PostFaelles {
  art: 'indbetaling';
  /** Who paid. */
  navn: string;
  note: string | null;
  /** From a Betalingsmelding: `registreretAf` confirmed it ("Bekræftet af"). */
  bekraeftet: boolean;
}

/** A Hævning in Kassen's list. */
export interface HaevningPost extends PostFaelles {
  art: 'haevning';
  formaal: string;
}

/** One row in Kassen's list. */
export type KassePost = IndbetalingPost | HaevningPost;

interface PostKontekst {
  /** Medlem id → name, Udmeldte included. */
  navne: ReadonlyMap<string, string>;
  senesteSaesonId: string | null;
  erAdmin: boolean;
}

/** Kassen's list: every Indbetaling and Hævning, newest first. */
export function kassePoster(
  rows: readonly IndbetalingRaekke[],
  ctx: PostKontekst,
  haevninger: readonly HaevningRaekke[] = [],
): KassePost[] {
  const navn = (id: string | null) => (id && ctx.navne.get(id)) || '';
  const faelles = (r: IndbetalingRaekke | HaevningRaekke): PostFaelles => ({
    id: r.id,
    beloeb: r.beloeb,
    registreretAf: navn(r.registreret_af),
    tid: r.registreret,
    annulleret: r.annulleret ? { af: navn(r.annulleret_af), tid: r.annulleret, note: r.annulleret_note } : null,
    kanAnnulleres: ctx.erAdmin && !r.annulleret && r.saeson_id === ctx.senesteSaesonId,
  });
  return [
    ...rows.map(
      (r): KassePost => ({
        art: 'indbetaling',
        ...faelles(r),
        navn: navn(r.medlem_id),
        note: r.note,
        bekraeftet: r.betalingsmelding_id !== null,
      }),
    ),
    ...haevninger.map((r): KassePost => ({ art: 'haevning', ...faelles(r), formaal: r.formaal })),
  ].sort((a, b) => (a.tid < b.tid ? 1 : a.tid > b.tid ? -1 : 0));
}

/**
 * The Hæv penge form: the amount as whole kroner (null if not), whether it
 * is more than Kassen holds, and whether the form can be sent (a valid
 * amount up to Kassen and a purpose).
 */
export function haevTjek(
  beloeb: string,
  formaal: string,
  kassen: number,
): { kr: number | null; overKassen: boolean; klar: boolean } {
  const kr = parsePris(beloeb);
  const overKassen = kr !== null && kr > kassen;
  return { kr, overKassen, klar: kr !== null && !overKassen && formaal.trim() !== '' };
}

/** Someone an Admin can register an Indbetaling from. */
export interface Betaler {
  id: string;
  navn: string;
  /** What they owe in kr; negative = Til gode. */
  saldo: number;
  udmeldt: boolean;
}

const danskOrden = new Intl.Collator('da');

/** Every Medlem of the box with their Saldo: active ones, then Udmeldte. Each in Danish name order. */
export function betalere(
  medlemmer: readonly { id: string; navn: string; udmeldt: string | null }[],
  saldi: readonly { medlem_id: string; saldo: number }[],
): { aktive: Betaler[]; udmeldte: Betaler[] } {
  const saldoFor = new Map(saldi.map((s) => [s.medlem_id, s.saldo]));
  const alle = medlemmer
    .map((m) => ({ id: m.id, navn: m.navn, saldo: saldoFor.get(m.id) ?? 0, udmeldt: m.udmeldt !== null }))
    .sort((a, b) => danskOrden.compare(a.navn, b.navn));
  return { aktive: alle.filter((b) => !b.udmeldt), udmeldte: alle.filter((b) => b.udmeldt) };
}

/** Registrér indbetaling starts with what the Medlem owes; empty when they owe nothing. */
export function forudfyldtBeloeb(saldo: number): string {
  return saldo > 0 ? String(saldo) : '';
}

const dag = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Copenhagen' });

/** "i dag", "i går" or a short date ("8. okt"), by the Danish calendar day. */
export function dagTekst(iso: string, nu: Date = new Date()): string {
  const dato = dag.format(new Date(iso));
  if (dato === dag.format(nu)) return t('kassen.iDag');
  const igaar = new Date(nu.getTime() - 24 * 60 * 60 * 1000);
  if (dato === dag.format(igaar)) return t('kassen.iGaar');
  return kortDato(iso, nu);
}
