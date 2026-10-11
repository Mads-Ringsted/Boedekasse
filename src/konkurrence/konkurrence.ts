import type { Annullering } from '../aktivitet/haendelse.ts';

/** One Medlem in a Konkurrence's result. `plads` null = Fraværende. */
export interface Deltager {
  medlemId: string;
  navn: string;
  loggetInd: boolean;
  plads: number | null;
  /** The Gebyr they pay for it (the annulled amount on an annulled Konkurrence). */
  beloeb: number;
}

/** A Konkurrence as the list, the result screen and the feed show it (view `konkurrence_visning`). */
export interface Konkurrence {
  id: string;
  saesonId: string;
  titel: string;
  /** yyyy-mm-dd */
  dato: string;
  oprettetAf: string;
  oprettetAfNavn: string;
  rettetAf: string | null;
  rettetAfNavn: string | null;
  annullering: Annullering | null;
  antalPlaceret: number;
  antalFravaerende: number;
  antalGebyrer: number;
  total: number;
  /** Placed by place, then the absent. */
  resultat: Deltager[];
}

type Obj = Record<string, unknown>;
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const strEllerNull = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const tal = (v: unknown): number => (typeof v === 'number' ? v : 0);

/** A row of `konkurrence_visning` (or `aktivitet.konkurrence`). */
export function tilKonkurrence(raw: unknown): Konkurrence {
  const r = (raw ?? {}) as Obj;
  const annulleret = strEllerNull(r.annulleret);
  return {
    id: str(r.id),
    saesonId: str(r.saeson_id),
    titel: str(r.titel),
    dato: str(r.dato),
    oprettetAf: str(r.oprettet_af),
    oprettetAfNavn: str(r.oprettet_af_navn),
    rettetAf: strEllerNull(r.rettet_af),
    rettetAfNavn: strEllerNull(r.rettet_af_navn),
    annullering: annulleret
      ? {
          tid: annulleret,
          afId: strEllerNull(r.annulleret_af),
          afNavn: str(r.annulleret_af_navn),
          note: strEllerNull(r.annulleret_note),
        }
      : null,
    antalPlaceret: tal(r.antal_placeret),
    antalFravaerende: tal(r.antal_fravaerende),
    antalGebyrer: tal(r.antal_gebyrer),
    total: tal(r.total),
    resultat: (Array.isArray(r.resultat) ? (r.resultat as Obj[]) : []).map((d) => ({
      medlemId: str(d.medlem_id),
      navn: str(d.navn),
      loggetInd: d.logget_ind === true,
      plads: typeof d.plads === 'number' ? d.plads : null,
      beloeb: tal(d.beloeb),
    })),
  };
}

/** Who came first (more than one on a tie). */
export const vindere = (k: Pick<Konkurrence, 'resultat'>): Deltager[] => k.resultat.filter((d) => d.plads === 1);

/**
 * What the caller may do with a Konkurrence: only its recorder or an Admin,
 * never once annulled. Correcting needs the running Sæson to be its Sæson;
 * annulling works on the latest Sæson (Pause included).
 */
export function handlinger(
  k: Pick<Konkurrence, 'oprettetAf' | 'saesonId' | 'annullering'>,
  mig: { medlemId: string; erAdmin: boolean },
  saeson: { aktivSaesonId: string | null; senesteSaesonId: string | null },
): { ret: boolean; annuller: boolean } {
  const maa = !k.annullering && (mig.erAdmin || k.oprettetAf === mig.medlemId);
  return { ret: maa && saeson.aktivSaesonId === k.saesonId, annuller: maa && saeson.senesteSaesonId === k.saesonId };
}

const iDagFormat =new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Copenhagen',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Today's Copenhagen date as yyyy-mm-dd (the Dato field's default). */
export const iDagDato = (nu: Date = new Date()): string => iDagFormat.format(nu);

const langFormat = new Intl.DateTimeFormat('da', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' });
const kortFormat = new Intl.DateTimeFormat('da', { timeZone: 'UTC', day: 'numeric', month: 'short' });
const udenPunktum = (s: string) => s.replace(/(\p{L})\./gu, '$1');

/** A Konkurrence's date (yyyy-mm-dd): "10. okt 2026", or "10. okt" with `kort` in the same year. */
export function konkurrenceDato(dato: string, kort = false, nu: Date = new Date()): string {
  const d = new Date(`${dato}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return dato;
  const sammeAar = dato.slice(0, 4) === iDagDato(nu).slice(0, 4);
  return udenPunktum((kort && sammeAar ? kortFormat : langFormat).format(d));
}
