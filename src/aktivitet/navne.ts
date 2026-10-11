import { t } from '../strings/index.ts';
import type { Kontekst } from './visning.ts';

const fornavn = (navn: string) => navn.trim().split(/\s+/)[0] ?? '';

/** A Medlem as the subject of a feed sentence: "Du", or their first name. */
export function hvem(id: string | null, navn: string | null, ctx: Kontekst): string {
  return id !== null && id === ctx.migId ? t('aktivitet.du') : fornavn(navn ?? '');
}

/** A Medlem as the object of a feed sentence: "dig", or their first name. */
export function hvemObjekt(id: string | null, navn: string | null, ctx: Kontekst): string {
  return id !== null && id === ctx.migId ? t('aktivitet.dig') : fornavn(navn ?? '');
}
