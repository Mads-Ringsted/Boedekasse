import { formatKr, t } from '../strings/index.ts';
import type { Indstillinger } from './indstillinger.ts';
import type { RegelStatus, TilNoegle } from './regel.ts';
import { regelStatus } from './regler.ts';

/**
 * The Gebyrer page (#95): its rules and their status helpers. Each Gebyr is a
 * `Regel`, so `RegelRaekke` and `RegelSheet` draw it like the hub's rules.
 */

// ── Status helpers: one per Gebyr ────────────────────────────────────────

/** Ny bødekategori: "Til · 25 kr". */
export function oprettelsesgebyrStatus(ind: Pick<Indstillinger, 'oprettelsesgebyr_til' | 'oprettelsesgebyr'>): RegelStatus {
  return regelStatus(ind.oprettelsesgebyr_til, formatKr(ind.oprettelsesgebyr));
}

/** The Engangsbøde Gebyr: "Til · 10 kr". */
export function engangsgebyrStatus(ind: Pick<Indstillinger, 'engangsgebyr_til' | 'engangsgebyr'>): RegelStatus {
  return regelStatus(ind.engangsgebyr_til, formatKr(ind.engangsgebyr));
}

/** Dos-bonus: "Til · 50 kr". */
export function dosBonusStatus(ind: Pick<Indstillinger, 'dos_bonus_til' | 'dos_bonus_beloeb'>): RegelStatus {
  return regelStatus(ind.dos_bonus_til, formatKr(ind.dos_bonus_beloeb));
}

/** Catch-up: "Til · De 2 laveste betaler 20 kr d. 1." */
export function catchUpStatus(ind: Pick<Indstillinger, 'catch_up_til' | 'catch_up_antal' | 'catch_up_beloeb'>): RegelStatus {
  const beloeb = formatKr(ind.catch_up_beloeb);
  return regelStatus(
    ind.catch_up_til,
    ind.catch_up_antal === 1
      ? t('indstillinger.catchUpResumeEn', { beloeb })
      : t('indstillinger.catchUpResume', { antal: ind.catch_up_antal, beloeb }),
  );
}

/** Sen betaling: "Til · 20 kr pr. dag efter den 5., højst 100 kr om måneden". */
export function senBetalingStatus(
  ind: Pick<Indstillinger, 'sen_betaling_til' | 'sen_betaling_beloeb' | 'betalingsdag' | 'sen_betaling_loft'>,
): RegelStatus {
  const beloeb = formatKr(ind.sen_betaling_beloeb);
  const dag = ind.betalingsdag;
  return regelStatus(
    ind.sen_betaling_til,
    ind.sen_betaling_loft === null
      ? t('indstillinger.senBetalingResume', { beloeb, dag })
      : t('indstillinger.senBetalingResumeLoft', { beloeb, dag, loft: formatKr(ind.sen_betaling_loft) }),
  );
}

/** The switches the hub's Gebyrer row counts: every Gebyr with an on/off. */
const GEBYR_SWITCHES = [
  'oprettelsesgebyr_til',
  'engangsgebyr_til',
  'dos_bonus_til',
  'catch_up_til',
  'sen_betaling_til',
] as const satisfies readonly TilNoegle[];

/**
 * The hub's Gebyrer row: "3 slået til", or a muted "Ingen slået til".
 * Tilbagevendende Gebyrer have no switch, so they don't count.
 */
export function gebyrerStatus(ind: Pick<Indstillinger, (typeof GEBYR_SWITCHES)[number]>): RegelStatus {
  const antal = GEBYR_SWITCHES.filter((noegle) => ind[noegle]).length;
  return antal === 0
    ? { til: false, tekst: t('indstillinger.gebyrerIngenSlaaetTil') }
    : { til: true, tekst: t('indstillinger.gebyrerSlaaetTil', { antal }) };
}
