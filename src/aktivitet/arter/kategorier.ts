import { formatKr, t } from '../../strings/index.ts';
import { hvem } from '../navne.ts';
import type { Beskriver, Ikon } from '../visning.ts';
import { dataTal, dataTekst, gebyrTekst } from './faelles.ts';

// Bødekategori entries (#52): ref_tabel 'bodekategori', aktoer = who did it.
const ikon: Ikon = { slags: 'symbol', symbol: 'kategori' };

/** 'bodekategori_oprettet' {navn, pris}, with its creation Gebyr (#57). */
export const bodekategoriOprettet: Beskriver = (h, ctx) => ({
  ikon,
  titel: t('aktivitet.kategoriOprettet', { hvem: hvem(h.aktoerId, h.aktoerNavn, ctx), navn: dataTekst(h, 'navn') }),
  linje: t('aktivitet.kategoriOprettetLinje', { pris: formatKr(dataTal(h, 'pris')) }),
  gebyr: gebyrTekst(h.gebyrer),
  annulleret: false,
});

/** 'bodekategori_ompriset' {navn, gammel_pris, ny_pris}. */
export const bodekategoriOmpriset: Beskriver = (h, ctx) => ({
  ikon,
  titel: t('aktivitet.kategoriOmpriset', { hvem: hvem(h.aktoerId, h.aktoerNavn, ctx), navn: dataTekst(h, 'navn') }),
  linje: t('aktivitet.kategoriOmprisetLinje', {
    gammel: formatKr(dataTal(h, 'gammel_pris')),
    ny: formatKr(dataTal(h, 'ny_pris')),
  }),
  annulleret: false,
});

/** 'bodekategori_arkiveret' {navn, pris}. */
export const bodekategoriArkiveret: Beskriver = (h, ctx) => ({
  ikon,
  titel: t('aktivitet.kategoriArkiveret', { hvem: hvem(h.aktoerId, h.aktoerNavn, ctx), navn: dataTekst(h, 'navn') }),
  linje: t('aktivitet.kategoriArkiveretLinje', { pris: formatKr(dataTal(h, 'pris')) }),
  annulleret: false,
});
