import { kortDato } from '../../kategorier/kategoriListe.ts';
import { formatKr, t } from '../../strings/index.ts';
import { hvem } from '../navne.ts';
import type { Beskriver } from '../visning.ts';
import { dataTal, dataTekst } from './faelles.ts';

// Dos-bonus entries (#77).

/** The Bødekategori names in the entry's data, joined: "For sent, Øl". */
function kategorier(v: unknown): string {
  return Array.isArray(v) ? v.filter((n): n is string => typeof n === 'string').join(', ') : '';
}

/**
 * 'dos_bonus' {dag, beloeb, kategorier}: the box charged modtager a Dos-bonus
 * for the Dos-bonus day `dag` (YYYY-MM-DD, 06:00 to 06:00), when these
 * Bødekategorier paired up. No aktoer. ref gebyr, so an annulled one (its
 * pair was broken) is struck through.
 */
export const dosBonus: Beskriver = (h, ctx) => {
  const dag = dataTekst(h, 'dag');
  return {
    ikon: { slags: 'avatar', navn: h.modtagerNavn ?? '', egen: h.modtagerId === ctx.migId },
    titel: t('aktivitet.fikDosBonus', { hvem: hvem(h.modtagerId, h.modtagerNavn, ctx) }),
    tag: { tekst: t('dosBonus.tag'), tone: 'advarsel' },
    linje: [kategorier(h.data.kategorier), dag && t('aktivitet.dosBonusDag', { dag: kortDato(`${dag}T12:00:00Z`) })]
      .filter(Boolean)
      .join(' · '),
    beloeb: { tekst: formatKr(dataTal(h, 'beloeb')) },
    annulleret: false,
  };
};
