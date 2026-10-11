import { formatKr, t } from '../../strings/index.ts';
import { hvem, hvemObjekt } from '../navne.ts';
import type { Beskriver } from '../visning.ts';
import { dataTal, dataTekst } from './faelles.ts';

// Frikøb entries (#65).

/**
 * 'frikob_koebt' {navn, beloeb}: the Medlem (modtager) bought a Frikøb on a
 * Bødekategori, or an Admin (aktoer) registered it for them. ref frikob, so
 * an annulment strikes it through. The amount is its Frikøbsgebyr.
 */
export const frikobKoebt: Beskriver = (h, ctx) => ({
  ikon: { slags: 'avatar', navn: h.modtagerNavn ?? '', egen: h.modtagerId === ctx.migId },
  titel: t('aktivitet.koebteFrikob', { hvem: hvem(h.modtagerId, h.modtagerNavn, ctx) }),
  tag: { tekst: t('frikob.tag'), tone: 'blaa' },
  linje: [
    t('aktivitet.frikobLinje', { navn: dataTekst(h, 'navn') }),
    h.aktoerId !== h.modtagerId && t('aktivitet.frikobRegistreretAf', { hvem: hvemObjekt(h.aktoerId, h.aktoerNavn, ctx) }),
  ]
    .filter(Boolean)
    .join(' · '),
  beloeb: { tekst: formatKr(dataTal(h, 'beloeb')) },
  annulleret: false,
});

/** 'frikob_annulleret' {frikob_id, navn, beloeb, note}: an Admin (aktoer) annulled it. No ref. */
export const frikobAnnulleret: Beskriver = (h, ctx) => ({
  ikon: { slags: 'avatar', navn: h.aktoerNavn ?? '', egen: h.aktoerId === ctx.migId },
  titel: t('aktivitet.annulleredeFrikob', { hvem: hvem(h.aktoerId, h.aktoerNavn, ctx) }),
  linje: [
    t('aktivitet.frikobTil', { hvem: hvemObjekt(h.modtagerId, h.modtagerNavn, ctx) }),
    dataTekst(h, 'navn'),
    formatKr(dataTal(h, 'beloeb')),
    dataTekst(h, 'note'),
  ]
    .filter(Boolean)
    .join(' · '),
  annulleret: false,
});
