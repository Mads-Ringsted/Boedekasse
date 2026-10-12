import { formatKr, t } from '../../strings/index.ts';
import { ejer, hvem, hvemObjekt } from '../navne.ts';
import type { Beskriver } from '../visning.ts';
import { annullerbartGebyr, dataTal, dataTekst, gebyrTekst } from './faelles.ts';

// Anke entries: filed (#63) and the verdict (#64).

/**
 * 'anke_indgivet' {bode_id, navn, pris}: the receiver (aktoer) appealed a
 * Bøde from the giver (modtager). ref anke, so its Anke Gebyr is in
 * `gebyrer`. Tapping opens the Bøde; for Admins it opens "Annullér gebyr"
 * while the Gebyr stands.
 */
export const ankeIndgivet: Beskriver = (h, ctx) => {
  const bodeId = dataTekst(h, 'bode_id');
  return {
    ikon: { slags: 'avatar', navn: h.aktoerNavn ?? '', egen: h.aktoerId === ctx.migId },
    titel: t('aktivitet.ankede', {
      hvem: hvem(h.aktoerId, h.aktoerNavn, ctx),
      ejer: ejer(h.modtagerId, h.modtagerNavn, h.aktoerId, ctx, 'n'),
    }),
    linje: [dataTekst(h, 'navn'), formatKr(dataTal(h, 'pris'))].join(' · '),
    gebyr: gebyrTekst(h.gebyrer),
    annulleret: false,
    annullerGebyr: annullerbartGebyr(h.gebyrer),
    ...(bodeId ? { boedeId: bodeId } : {}),
  };
};

/**
 * 'anke_afgjort' {bode_id, navn, pris, afgoerelse, aendret, appellant_id,
 * appellant_navn}: someone (aktoer) recorded or changed the verdict on the
 * appellant's Anke against the giver (modtager). "Emil vandt anken mod
 * Jonas · For sent · 50 kr · afgjort af Frederik". The Anke Gebyr stays on
 * the Anke row, so it is not repeated here. Tapping opens the Bøde.
 */
export const ankeAfgjort: Beskriver = (h, ctx) => {
  const bodeId = dataTekst(h, 'bode_id');
  const appellantId = dataTekst(h, 'appellant_id') || null;
  const appellantNavn = dataTekst(h, 'appellant_navn');
  const vandt = dataTekst(h, 'afgoerelse') === 'modtager_vandt';
  const parter = {
    hvem: hvem(appellantId, appellantNavn, ctx),
    modpart: hvemObjekt(h.modtagerId, h.modtagerNavn, ctx),
  };
  const af = hvemObjekt(h.aktoerId, h.aktoerNavn, ctx);
  return {
    ikon: { slags: 'avatar', navn: appellantNavn, egen: appellantId === ctx.migId },
    titel: vandt ? t('aktivitet.ankeVandt', parter) : t('aktivitet.ankeTabt', parter),
    tag: vandt ? { tekst: t('boede.tag.vundet'), tone: 'groen' } : { tekst: t('boede.tag.tabt'), tone: 'roed' },
    linje: [
      dataTekst(h, 'navn'),
      formatKr(dataTal(h, 'pris')),
      h.data.aendret === true ? t('aktivitet.aendretAf', { navn: af }) : t('aktivitet.afgjortAf', { navn: af }),
    ].join(' · '),
    annulleret: false,
    ...(bodeId ? { boedeId: bodeId } : {}),
  };
};
