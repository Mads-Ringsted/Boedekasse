import { tilbageTekst } from '../../anke/anke.ts';
import { formatKr, t } from '../../strings/index.ts';
import type { Boede } from '../haendelse.ts';
import { hvem, hvemObjekt } from '../navne.ts';
import { givetTekst, siden } from '../tid.ts';
import type { Kontekst } from '../visning.ts';

/** "Fra Frederik til dig · 5 t". */
export function fraTil(b: Boede, ctx: Kontekst, nu: Date = new Date()): string {
  return t('boede.fraTil', {
    giver: hvemObjekt(b.giverId, b.giverNavn, ctx),
    modtager: hvemObjekt(b.modtagerId, b.modtagerNavn, ctx),
    siden: siden(b.givet, nu),
  });
}

/** One line of the sheet's info card. */
export interface DetaljeRaekke {
  label: string;
  vaerdi: string;
}

/**
 * The info card: Givet, then how long you can still appeal (`ankeVindue`,
 * only when you may), the Engangsbøde Gebyr, the Anke, and who annulled it.
 */
export function detaljeRaekker(
  b: Boede,
  ctx: Kontekst,
  nu: Date = new Date(),
  ankeVindue: { msTilbage: number } | null = null,
): DetaljeRaekke[] {
  const raekker: DetaljeRaekke[] = [{ label: t('boede.givet'), vaerdi: givetTekst(b.givet, nu) }];

  if (ankeVindue) {
    raekker.push({ label: t('anke.kanAnkes'), vaerdi: t('anke.endnu', { tid: tilbageTekst(ankeVindue.msTilbage) }) });
  }

  if (b.engangsbode && b.gebyr > 0) {
    raekker.push({
      label: t('boede.gebyr'),
      vaerdi: t('boede.gebyrVaerdi', { beloeb: formatKr(b.gebyr), navn: hvemObjekt(b.giverId, b.giverNavn, ctx) }),
    });
  }

  if (b.ankeId) {
    const vaerdi = b.anket
      ? t('boede.anke.venter')
      : b.annullering && !b.afgoerelse
        ? t('boede.anke.annulleret')
      : b.afgoerelse === 'modtager_vandt'
        ? t('boede.anke.vandt')
        : b.afgoerelse === 'giver_vandt'
          ? t('boede.anke.staar')
          : t('boede.anke.ikkeAfgjort');
    raekker.push({ label: t('boede.anke'), vaerdi });
  }

  if (b.annullering) {
    raekker.push({
      label: t('boede.annulleretAf'),
      vaerdi: hvem(b.annullering.afId, b.annullering.afNavn, ctx),
    });
    if (b.annullering.note) raekker.push({ label: t('boede.note'), vaerdi: b.annullering.note });
  }

  return raekker;
}
