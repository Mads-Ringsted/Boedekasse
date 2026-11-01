import { kortDato } from '../../kategorier/kategoriListe.ts';
import { formatKr, t } from '../../strings/index.ts';
import { hvem } from '../navne.ts';
import type { Beskriver } from '../visning.ts';
import { avatarIkon, dataTal, dataTekst } from './faelles.ts';

// Automatic Gebyrer (#74). The scheduler (private.koer_automatik) writes one
// entry per Gebyr, from the system (no aktoer), for the payer (modtager),
// about the Gebyr itself (ref gebyr), so an annulment strikes it through.

const maanedNavn = new Intl.DateTimeFormat('da', { month: 'long', timeZone: 'UTC' });

/** "oktober" for '2026-10-01'; '' when missing. */
function maaned(dato: string): string {
  return dato ? maanedNavn.format(new Date(`${dato}T00:00:00Z`)) : '';
}

/**
 * 'catch_up' {maaned, beloeb, total} (#78): the payer was among the lowest
 * Sæson totals at the end of `maaned` (its 1st). An Admin may annul it from
 * the row while it stands.
 */
export const catchUp: Beskriver = (h, ctx) => {
  const beloeb = dataTal(h, 'beloeb');
  return {
    ikon: avatarIkon(h.modtagerId, h.modtagerNavn, ctx),
    titel: t('aktivitet.fikCatchUp', {
      hvem: hvem(h.modtagerId, h.modtagerNavn, ctx),
      maaned: maaned(dataTekst(h, 'maaned')),
    }),
    linje: t('aktivitet.catchUpLinje', { total: formatKr(dataTal(h, 'total')) }),
    beloeb: { tekst: formatKr(beloeb) },
    annulleret: false,
    ...(h.refId && h.modtagerId && !h.annullering
      ? {
          annullerGebyr: {
            id: h.refId,
            art: 'catch_up',
            beloeb,
            medlemId: h.modtagerId,
            medlemNavn: h.modtagerNavn ?? '',
            annullering: null,
          },
        }
      : {}),
  };
};

/** The Bødekategori names in the entry's data, joined: "For sent, Øl". */
function kategorier(v: unknown): string {
  return Array.isArray(v) ? v.filter((n): n is string => typeof n === 'string').join(', ') : '';
}

/**
 * 'dos_bonus' {dag, beloeb, kategorier} (#77): written by the Dos-bonus
 * recompute in the RPCs (not the scheduler) when the payer bore two Bøder
 * from one Bødekategori on Dos-bonus day `dag` (YYYY-MM-DD, 06:00 to 06:00).
 * `kategorier` are the day's paired Bødekategorier. Annulled (struck through)
 * when its pair is broken. An Admin or a Kasserer may also annul it from the
 * row while it stands; it then still counts as charged, so it never returns.
 */
export const dosBonus: Beskriver = (h, ctx) => {
  const dag = dataTekst(h, 'dag');
  const beloeb = dataTal(h, 'beloeb');
  return {
    ikon: avatarIkon(h.modtagerId, h.modtagerNavn, ctx),
    titel: t('aktivitet.fikDosBonus', { hvem: hvem(h.modtagerId, h.modtagerNavn, ctx) }),
    tag: { tekst: t('dosBonus.tag'), tone: 'advarsel' },
    linje: [kategorier(h.data.kategorier), dag && t('aktivitet.dosBonusDag', { dag: kortDato(`${dag}T12:00:00Z`) })]
      .filter(Boolean)
      .join(' · '),
    beloeb: { tekst: formatKr(beloeb) },
    annulleret: false,
    ...(h.refId && h.modtagerId && !h.annullering
      ? {
          annullerGebyr: {
            id: h.refId,
            art: 'dos_bonus',
            beloeb,
            medlemId: h.modtagerId,
            medlemNavn: h.modtagerNavn ?? '',
            annullering: null,
          },
        }
      : {}),
  };
};

const dagNavn = new Intl.DateTimeFormat('da', { day: 'numeric', month: 'long', timeZone: 'UTC' });

/** "6. februar" for '2026-02-06'; '' when missing. */
function langDato(dato: string): string {
  return dato ? dagNavn.format(new Date(`${dato}T00:00:00Z`)) : '';
}

/**
 * 'sen_betaling' {dag, beloeb, skyldig, betalt} (#80): on `dag`, after the
 * Betalingsdag, the payer still hadn't paid what they owed at the end of last
 * month (`skyldig`); `betalt` is what had come in this month by then. An
 * Admin or a Kasserer may annul that one day from the row while it stands.
 */
export const senBetaling: Beskriver = (h, ctx) => {
  const beloeb = dataTal(h, 'beloeb');
  return {
    ikon: avatarIkon(h.modtagerId, h.modtagerNavn, ctx),
    titel: t('aktivitet.fikSenBetaling', {
      hvem: hvem(h.modtagerId, h.modtagerNavn, ctx),
      dag: langDato(dataTekst(h, 'dag')),
    }),
    linje: t('aktivitet.senBetalingLinje', {
      skyldig: formatKr(dataTal(h, 'skyldig')),
      betalt: formatKr(dataTal(h, 'betalt')),
    }),
    beloeb: { tekst: formatKr(beloeb) },
    annulleret: false,
    ...(h.refId && h.modtagerId && !h.annullering
      ? {
          annullerGebyr: {
            id: h.refId,
            art: 'sen_betaling',
            beloeb,
            medlemId: h.modtagerId,
            medlemNavn: h.modtagerNavn ?? '',
            annullering: null,
          },
        }
      : {}),
  };
};

/**
 * 'tilbagevendende' {navn, beloeb, dato} (#79): an occurrence on `dato` of
 * the Tilbagevendende Gebyr `navn` charged the payer. An Admin may annul that
 * one occurrence from the row while it stands.
 */
export const tilbagevendende: Beskriver = (h, ctx) => {
  const beloeb = dataTal(h, 'beloeb');
  return {
    ikon: avatarIkon(h.modtagerId, h.modtagerNavn, ctx),
    titel: t('aktivitet.fikTilbagevendende', {
      hvem: hvem(h.modtagerId, h.modtagerNavn, ctx),
      navn: dataTekst(h, 'navn'),
    }),
    linje: t('aktivitet.tilbagevendendeLinje', { dato: langDato(dataTekst(h, 'dato')) }),
    beloeb: { tekst: formatKr(beloeb) },
    annulleret: false,
    ...(h.refId && h.modtagerId && !h.annullering
      ? {
          annullerGebyr: {
            id: h.refId,
            art: 'tilbagevendende',
            beloeb,
            medlemId: h.modtagerId,
            medlemNavn: h.modtagerNavn ?? '',
            annullering: null,
          },
        }
      : {}),
  };
};
