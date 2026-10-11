import { formatKr, t } from '../../strings/index.ts';
import { ejer, hvem, hvemObjekt } from '../navne.ts';
import type { Beskriver } from '../visning.ts';
import { dataTal, dataTekst } from './faelles.ts';

// Annulment entries (#62). They have no ref, so they never show struck
// through themselves; the annulled row elsewhere in the feed does.

const linje = (...dele: string[]) => dele.filter(Boolean).join(' · ');

/**
 * 'bode_annulleret' {bode_id, giver_id, giver_navn, navn, pris, engangsbode,
 * gebyr, note}: aktoer annulled a Bøde given to modtager. Tapping opens it.
 */
export const bodeAnnulleret: Beskriver = (h, ctx) => {
  const vaerdier = {
    hvem: hvem(h.aktoerId, h.aktoerNavn, ctx),
    ejer: ejer(dataTekst(h, 'giver_id') || null, dataTekst(h, 'giver_navn'), h.aktoerId, ctx, 'n'),
    modtager: hvemObjekt(h.modtagerId, h.modtagerNavn, ctx),
  };
  const bodeId = dataTekst(h, 'bode_id');
  return {
    ikon: { slags: 'avatar', navn: h.aktoerNavn ?? '', egen: h.aktoerId === ctx.migId },
    titel:
      h.data.engangsbode === true
        ? t('aktivitet.annulleredeEngangsboede', vaerdier)
        : t('aktivitet.annulleredeBoede', vaerdier),
    linje: linje(dataTekst(h, 'navn'), formatKr(dataTal(h, 'pris')), dataTekst(h, 'note')),
    gebyr: dataTal(h, 'gebyr') > 0 ? t('aktivitet.gebyrAnnulleret') : undefined,
    annulleret: false,
    ...(bodeId ? { boedeId: bodeId } : {}),
  };
};

/**
 * 'gebyr_annulleret' {gebyr_id, art, navn, beloeb, note}: an Admin (aktoer)
 * annulled a creation or Anke Gebyr that modtager paid.
 */
export const gebyrAnnulleret: Beskriver = (h, ctx) => {
  const navn = dataTekst(h, 'navn');
  const art = dataTekst(h, 'art');
  const aarsag =
    art === 'oprettelse'
      ? t('aktivitet.gebyrOprettelse', { navn })
      : art === 'anke'
        ? t('aktivitet.gebyrAnke', { navn })
        : t('aktivitet.gebyrAndet');
  return {
    ikon: { slags: 'avatar', navn: h.aktoerNavn ?? '', egen: h.aktoerId === ctx.migId },
    titel: t('aktivitet.annulleredeGebyr', {
      hvem: hvem(h.aktoerId, h.aktoerNavn, ctx),
      ejer: ejer(h.modtagerId, h.modtagerNavn, h.aktoerId, ctx, 't'),
    }),
    linje: linje(aarsag, formatKr(dataTal(h, 'beloeb')), dataTekst(h, 'note')),
    annulleret: false,
  };
};
