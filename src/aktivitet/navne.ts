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

/**
 * Whose something is, as a feed sentence says it: "din"/"dit" when it is
 * yours, "sin"/"sit" when it is the subject's own, else the first name in the
 * genitive ("Emils", "Jonas'"). `t` for neuter nouns (et gebyr), `n` for
 * common ones (en bøde).
 */
export function ejer(
  id: string | null,
  navn: string | null,
  subjektId: string | null,
  ctx: Kontekst,
  koen: 'n' | 't',
): string {
  if (id !== null && id === ctx.migId) return t(koen === 'n' ? 'aktivitet.din' : 'aktivitet.dit');
  if (id !== null && id === subjektId) return t(koen === 'n' ? 'aktivitet.sin' : 'aktivitet.sit');
  const f = fornavn(navn ?? '');
  return /[sxz]$/i.test(f) ? t('aktivitet.ejerGenitivS', { navn: f }) : t('aktivitet.ejerGenitiv', { navn: f });
}
