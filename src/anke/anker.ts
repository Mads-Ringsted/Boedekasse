import type { Boede } from '../aktivitet/haendelse.ts';
import { ejer, hvem } from '../aktivitet/navne.ts';
import { siden } from '../aktivitet/tid.ts';
import type { Kontekst, Raekke } from '../aktivitet/visning.ts';
import { formatKr, t } from '../strings/index.ts';

/**
 * One open Anke on Mere → Anker, drawn like a feed row: "Emil ankede
 * Frederiks bøde", the Bøde's name and age (no Anket tag: every row is).
 * Tapping opens the Bøde, where the verdict is recorded (#64).
 */
export function ankerRaekke(b: Boede, ctx: Kontekst, nu: Date = new Date()): Raekke {
  return {
    ikon: { slags: 'avatar', navn: b.modtagerNavn, egen: b.modtagerId === ctx.migId },
    titel: t('aktivitet.ankede', {
      hvem: hvem(b.modtagerId, b.modtagerNavn, ctx),
      ejer: ejer(b.giverId, b.giverNavn, b.modtagerId, ctx, 'n'),
    }),
    linje: [b.navn, siden(b.givet, nu)].join(' · '),
    beloeb: { tekst: formatKr(b.pris) },
    annulleret: false,
    boedeId: b.id,
  };
}
