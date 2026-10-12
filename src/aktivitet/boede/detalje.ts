import { tilbageTekst } from '../../anke/anke.ts';
import { formatKr, t } from '../../strings/index.ts';
import type { Boede } from '../haendelse.ts';
import { hvem, hvemObjekt } from '../navne.ts';
import { dagOverskrift, givetTekst, siden } from '../tid.ts';
import type { Kontekst } from '../visning.ts';

/** "Fra Frederik til dig · 5 t". */
export function fraTil(b: Boede, ctx: Kontekst, nu: Date = new Date()): string {
  return t('boede.fraTil', {
    giver: hvemObjekt(b.giverId, b.giverNavn, ctx),
    modtager: hvemObjekt(b.modtagerId, b.modtagerNavn, ctx),
    siden: siden(b.givet, nu),
  });
}

const stort = (s: string) => s.charAt(0).toLocaleUpperCase('da') + s.slice(1);
const smaat = (s: string) => s.charAt(0).toLocaleLowerCase('da') + s.slice(1);

/** The name of the giver or the receiver, by id. */
const navnPaa = (b: Boede, id: string | null) => (id === b.giverId ? b.giverNavn : b.modtagerNavn);

/** One line of the sheet's info card. */
export interface DetaljeRaekke {
  label: string;
  vaerdi: string;
}

/**
 * The info card: Givet, then how long you can still appeal (`ankeVindue`,
 * only when you may), the Engangsbøde Gebyr, the Anke (after a verdict: who
 * pays now and who decided), the Anke Gebyr, and who annulled it.
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
    const staar = !b.annullering && (b.afgoerelse === 'modtager_vandt' || b.afgoerelse === 'giver_vandt');
    if (staar) {
      // Anke vundet / tabt (boede-aendr-afgoerelse.html): who pays now, who decided.
      raekker.push({ label: t('boede.betalesNuAf'), vaerdi: stort(hvemObjekt(b.baererId, navnPaa(b, b.baererId), ctx)) });
      if (b.afgjort) {
        raekker.push({
          label: t('boede.afgjortAf'),
          vaerdi: t('boede.afgjortAfVaerdi', {
            hvem: stort(hvemObjekt(b.afgjort.afId, b.afgjort.afNavn, ctx)),
            dag: smaat(dagOverskrift(b.afgjort.tid, nu)),
          }),
        });
      }
      if (b.aendret) {
        raekker.push({
          label: t('boede.aendretAf'),
          vaerdi: t('boede.afgjortAfVaerdi', {
            hvem: stort(hvemObjekt(b.aendret.afId, b.aendret.afNavn, ctx)),
            dag: smaat(dagOverskrift(b.aendret.tid, nu)),
          }),
        });
      }
    } else {
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
    if (b.ankeGebyr !== null) {
      raekker.push({
        label: t('boede.ankegebyr', { hvem: hvemObjekt(b.modtagerId, b.modtagerNavn, ctx) }),
        vaerdi: formatKr(b.ankeGebyr),
      });
    }
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
