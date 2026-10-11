import { formatKr, t } from '../../strings/index.ts';
import { hvem, hvemObjekt } from '../navne.ts';
import type { Beskriver } from '../visning.ts';
import { dataTal, dataTekst } from './faelles.ts';

// Money entries (#59, #60 Betalingsmeldinger). #61 adds Hævninger.

/**
 * 'indbetaling' {navn, beloeb, note}: an Admin (aktoer) registered money the
 * Medlem (modtager) paid. ref indbetaling, so an annulment strikes it through.
 */
export const indbetaling: Beskriver = (h, ctx) => ({
  ikon: { slags: 'avatar', navn: h.modtagerNavn ?? '', egen: h.modtagerId === ctx.migId },
  titel: t('aktivitet.betalteInd', { hvem: hvem(h.modtagerId, h.modtagerNavn, ctx) }),
  linje: [t('aktivitet.registreretAf', { hvem: hvemObjekt(h.aktoerId, h.aktoerNavn, ctx) }), dataTekst(h, 'note')]
    .filter(Boolean)
    .join(' · '),
  beloeb: { tekst: t('kassen.plus', { beloeb: formatKr(dataTal(h, 'beloeb')) }), tone: 'groen' },
  annulleret: false,
});

/** 'indbetaling_annulleret' {indbetaling_id, navn, beloeb, note}: an Admin (aktoer) annulled it. No ref. */
export const indbetalingAnnulleret: Beskriver = (h, ctx) => ({
  ikon: { slags: 'avatar', navn: h.aktoerNavn ?? '', egen: h.aktoerId === ctx.migId },
  titel: t('aktivitet.annulleredeIndbetaling', { hvem: hvem(h.aktoerId, h.aktoerNavn, ctx) }),
  linje: [
    t('aktivitet.fra', { hvem: hvemObjekt(h.modtagerId, h.modtagerNavn, ctx) }),
    formatKr(dataTal(h, 'beloeb')),
    dataTekst(h, 'note'),
  ]
    .filter(Boolean)
    .join(' · '),
  annulleret: false,
});

/**
 * 'betaling_bekraeftet' {navn, beloeb}: a Medlem (aktoer) confirmed the
 * reporter's (modtager) Betalingsmelding. ref indbetaling, so an annulment
 * strikes it through.
 */
export const betalingBekraeftet: Beskriver = (h, ctx) => ({
  ikon: { slags: 'avatar', navn: h.modtagerNavn ?? '', egen: h.modtagerId === ctx.migId },
  titel: t('aktivitet.betalteInd', { hvem: hvem(h.modtagerId, h.modtagerNavn, ctx) }),
  linje: t('aktivitet.bekraeftetAf', { hvem: hvemObjekt(h.aktoerId, h.aktoerNavn, ctx) }),
  beloeb: { tekst: t('kassen.plus', { beloeb: formatKr(dataTal(h, 'beloeb')) }), tone: 'groen' },
  annulleret: false,
});

/** 'betaling_afvist' {navn, beloeb}: a Medlem (aktoer) rejected the reporter's (modtager) Betalingsmelding. No ref. */
export const betalingAfvist: Beskriver = (h, ctx) => ({
  ikon: { slags: 'avatar', navn: h.aktoerNavn ?? '', egen: h.aktoerId === ctx.migId },
  titel: t('aktivitet.afvisteBetaling', { hvem: hvem(h.aktoerId, h.aktoerNavn, ctx) }),
  linje: [
    t('aktivitet.fra', { hvem: hvemObjekt(h.modtagerId, h.modtagerNavn, ctx) }),
    formatKr(dataTal(h, 'beloeb')),
  ].join(' · '),
  annulleret: false,
});
