import { t } from '../../strings/index.ts';
import { hvem, hvemObjekt } from '../navne.ts';
import type { Beskriver, Ikon } from '../visning.ts';
import { dataTekst } from './faelles.ts';

// Box and Sæson entries.
const ikon: Ikon = { slags: 'symbol', symbol: 'saeson', tone: 'blaa' };

/** 'bodekasse_oprettet' {bodekasse_navn, saeson_navn} (#50): also the first Sæson's start. */
export const bodekasseOprettet: Beskriver = (h, ctx) => ({
  ikon,
  titel: t('aktivitet.kasseOprettet', { hvem: hvem(h.aktoerId, h.aktoerNavn, ctx) }),
  linje: t('aktivitet.saesonStartet', { saeson: dataTekst(h, 'saeson_navn') }),
  annulleret: false,
});

/** 'saeson_startet' {saeson_navn}, aktoer = the Admin who started it. */
export const saesonStartet: Beskriver = (h, ctx) => ({
  ikon,
  titel: t('aktivitet.saesonStartet', { saeson: dataTekst(h, 'saeson_navn') }),
  linje: h.aktoerId ? t('aktivitet.startetAf', { hvem: hvemObjekt(h.aktoerId, h.aktoerNavn, ctx) }) : '',
  annulleret: false,
});

/**
 * 'saeson_afsluttet' {saeson_navn} (#67), in the ended Sæson. aktoer = the
 * Admin who ended it; null when it ended by its date.
 */
export const saesonAfsluttet: Beskriver = (h, ctx) => ({
  ikon,
  titel: t('aktivitet.saesonAfsluttet', { saeson: dataTekst(h, 'saeson_navn') }),
  linje: h.aktoerId ? t('aktivitet.afsluttetAf', { hvem: hvemObjekt(h.aktoerId, h.aktoerNavn, ctx) }) : '',
  annulleret: false,
});
