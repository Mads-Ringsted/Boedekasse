import type { Afgoerelse, Boede } from '../aktivitet/haendelse.ts';
import { hvem, hvemObjekt } from '../aktivitet/navne.ts';
import type { Kontekst } from '../aktivitet/visning.ts';
import { formatKr, t } from '../strings/index.ts';

type Mig = { medlemId: string; erAdmin: boolean };

/** The two verdicts a Medlem can record. `ikke_afgjort` only comes from a new Sæson. */
export type Valg = Extract<Afgoerelse, 'giver_vandt' | 'modtager_vandt'>;

/** You gave or received the Bøde. */
const erPart = (b: Boede, mig: Mig) => mig.medlemId === b.giverId || mig.medlemId === b.modtagerId;

/**
 * "Registrér gruppens afgørelse" (the rule `afgoer_anke` enforces): the Anke
 * is open (so the Bøde is not annulled), you are neither giver nor receiver,
 * and the Bøde is from the latest Sæson.
 */
export function kanRegistrereAfgoerelse(b: Boede, mig: Mig, iSenesteSaeson: boolean): boolean {
  return b.anket && iSenesteSaeson && !erPart(b, mig);
}

/** The Anke is open and you are one of the two involved: show "the group decides". */
export function partIAnken(b: Boede, mig: Mig): boolean {
  return b.anket && erPart(b, mig);
}

/**
 * "Ændr afgørelse" (the rule `aendr_afgoerelse` enforces): a recorded verdict
 * that still stands, on a Bøde from the latest Sæson, for whoever recorded it
 * or an Admin.
 */
export function kanAendreAfgoerelse(b: Boede, mig: Mig, iSenesteSaeson: boolean): boolean {
  if (b.annullering || !iSenesteSaeson) return false;
  if (b.afgoerelse !== 'giver_vandt' && b.afgoerelse !== 'modtager_vandt') return false;
  return mig.erAdmin || (b.afgjort?.afId ?? null) === mig.medlemId;
}

/** One radio card on the verdict sheet. */
export interface AfgoerelseValg {
  afgoerelse: Valg;
  titel: string;
  tekst: string;
}

/** The verdict sheet's two cards: "Bøden står ved magt" and "Anken vinder", with who pays. */
export function afgoerelseValg(b: Boede, ctx: Kontekst): AfgoerelseValg[] {
  return [
    {
      afgoerelse: 'giver_vandt',
      titel: t('afgoerelse.staar'),
      tekst: t('afgoerelse.staarTekst', { hvem: hvem(b.modtagerId, b.modtagerNavn, ctx), pris: formatKr(b.pris) }),
    },
    {
      afgoerelse: 'modtager_vandt',
      titel: t('afgoerelse.vinder'),
      tekst: t('afgoerelse.vinderTekst', { hvem: hvemObjekt(b.giverId, b.giverNavn, ctx) }),
    },
  ];
}
