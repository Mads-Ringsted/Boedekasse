import { formatKr, t } from '../../strings/index.ts';
import { ejer, hvem } from '../navne.ts';
import type { Beskriver } from '../visning.ts';
import { annullerbartGebyr, dataTal, dataTekst, gebyrTekst } from './faelles.ts';

// Anke entries (#63; #64 adds the verdict).

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
