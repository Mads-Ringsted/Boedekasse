import { t } from '../../strings/index.ts';
import { hvem, hvemObjekt } from '../navne.ts';
import type { Beskriver } from '../visning.ts';

// Medlem entries (#51). #69 adds Udmeldt and Genoptaget here.

/** 'medlem_tilfoejet': an Admin (aktoer) added the Medlem (modtager). */
export const medlemTilfoejet: Beskriver = (h, ctx) => ({
  ikon: { slags: 'avatar', navn: h.modtagerNavn ?? '', egen: h.modtagerId === ctx.migId },
  titel: t('aktivitet.medlemTilfoejet', {
    hvem: hvem(h.aktoerId, h.aktoerNavn, ctx),
    medlem: hvemObjekt(h.modtagerId, h.modtagerNavn, ctx),
  }),
  linje: t('aktivitet.medlemTilfoejetLinje'),
  annulleret: false,
});

/** 'medlem_tilmeldt': the Medlem (aktoer) joined with the code. */
export const medlemTilmeldt: Beskriver = (h, ctx) => ({
  ikon: { slags: 'avatar', navn: h.aktoerNavn ?? '', egen: h.aktoerId === ctx.migId },
  titel: t('aktivitet.medlemTilmeldt', { hvem: hvem(h.aktoerId, h.aktoerNavn, ctx) }),
  linje: t('aktivitet.medlemTilmeldtLinje'),
  annulleret: false,
});
