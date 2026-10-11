import { formatKr, t } from '../../strings/index.ts';
import { hvem, hvemObjekt } from '../navne.ts';
import type { Beskriver } from '../visning.ts';
import { dataTal, dataTekst } from './faelles.ts';

// Money entries: Indbetalinger (#59), Hævninger (#61). #60 adds Betalingsmeldinger.

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
 * 'haevning' {beloeb, formaal}: an Admin (aktoer) took money out of the box.
 * ref haevning, so an annulment strikes it through.
 */
export const haevning: Beskriver = (h, ctx) => ({
  ikon: { slags: 'symbol', symbol: 'haevning' },
  titel: t('aktivitet.haevetAf', { hvem: hvemObjekt(h.aktoerId, h.aktoerNavn, ctx) }),
  linje: dataTekst(h, 'formaal'),
  beloeb: { tekst: t('kassen.minus', { beloeb: formatKr(dataTal(h, 'beloeb')) }) },
  annulleret: false,
});

/** 'haevning_annulleret' {haevning_id, beloeb, formaal, note}: an Admin (aktoer) annulled it. No ref. */
export const haevningAnnulleret: Beskriver = (h, ctx) => ({
  ikon: { slags: 'avatar', navn: h.aktoerNavn ?? '', egen: h.aktoerId === ctx.migId },
  titel: t('aktivitet.annulleredeHaevning', { hvem: hvem(h.aktoerId, h.aktoerNavn, ctx) }),
  linje: [dataTekst(h, 'formaal'), formatKr(dataTal(h, 'beloeb')), dataTekst(h, 'note')].filter(Boolean).join(' · '),
  annulleret: false,
});
