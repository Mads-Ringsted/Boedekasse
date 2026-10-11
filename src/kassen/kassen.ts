import { kortDato } from '../kategorier/kategoriListe.ts';
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
}

/**
 * One row in Kassen's list. #61 adds Hævninger: widen `art` and give them
 * their own fields, then merge both kinds by `tid` in `kassePoster`.
 */
export interface KassePost {
  art: 'indbetaling';
  id: string;
  /** Who paid. */
  navn: string;
  beloeb: number;
  registreretAf: string;
  tid: string;
  note: string | null;
  /** Set when annulled: greyed and struck through. */
  annulleret: { af: string; tid: string; note: string | null } | null;
  /** Admins may annul it: not annulled yet, and in the latest Sæson. */
  kanAnnulleres: boolean;
}

interface PostKontekst {
  /** Medlem id → name, Udmeldte included. */
  navne: ReadonlyMap<string, string>;
  senesteSaesonId: string | null;
  erAdmin: boolean;
}

/** Kassen's list: every Indbetaling, newest first. */
export function kassePoster(rows: readonly IndbetalingRaekke[], ctx: PostKontekst): KassePost[] {
  const navn = (id: string | null) => (id && ctx.navne.get(id)) || '';
  return rows
    .map(
      (r): KassePost => ({
        art: 'indbetaling',
        id: r.id,
        navn: navn(r.medlem_id),
        beloeb: r.beloeb,
        registreretAf: navn(r.registreret_af),
        tid: r.registreret,
        note: r.note,
        annulleret: r.annulleret ? { af: navn(r.annulleret_af), tid: r.annulleret, note: r.annulleret_note } : null,
        kanAnnulleres: ctx.erAdmin && !r.annulleret && r.saeson_id === ctx.senesteSaesonId,
      }),
    )
    .sort((a, b) => (a.tid < b.tid ? 1 : a.tid > b.tid ? -1 : 0));
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
