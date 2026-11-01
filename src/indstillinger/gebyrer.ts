import { formatKr, t } from '../strings/index.ts';
import type { Indstillinger } from './indstillinger.ts';
import type { Regel, RegelStatus, TilNoegle } from './regel.ts';
import {
  ENGANGSGEBYR_SEKTION,
  kronerRegel,
  kronerStatus,
  regelStatus,
  tjekAntal,
  tjekBeloeb,
  tjekBetalingsdag,
  tjekLoft,
} from './regler.ts';

/**
 * The Gebyrer page (#95): its rules and their status helpers. Each Gebyr is a
 * `Regel`, so `LinkRaekke` and `RegelSheet` draw it like the hub's rules.
 */

// ── The single-amount Gebyrer's status helpers ───────────────────────────

/** Ny bødekategori: "Til · 25 kr". */
export const oprettelsesgebyrStatus = kronerStatus('oprettelsesgebyr_til', 'oprettelsesgebyr');

/** The Engangsbøde Gebyr: "Til · 10 kr". */
export const engangsgebyrStatus = kronerStatus('engangsgebyr_til', 'engangsgebyr');

/** Dos-bonus: "Til · 50 kr". */
export const dosBonusStatus = kronerStatus('dos_bonus_til', 'dos_bonus_beloeb');

// ── The rules ────────────────────────────────────────────────────────────

const kr = t('kategori.kr');

export const OPRETTELSESGEBYR: Regel = kronerRegel({
  id: 'oprettelsesgebyr',
  titel: t('indstillinger.oprettelsesgebyr'),
  til: 'oprettelsesgebyr_til',
  beloeb: 'oprettelsesgebyr',
  note: t('indstillinger.oprettelsesgebyrNote'),
});

/** The same setting as in the Engangsbøder sheet; one section, so no heading. */
export const ENGANGSGEBYR: Regel = {
  id: 'engangsgebyr',
  titel: t('indstillinger.engangsgebyr'),
  status: engangsgebyrStatus,
  sektioner: [{ ...ENGANGSGEBYR_SEKTION, titel: undefined }],
};

export const DOS_BONUS: Regel = kronerRegel({
  id: 'dosBonus',
  titel: t('indstillinger.dosBonus'),
  til: 'dos_bonus_til',
  beloeb: 'dos_bonus_beloeb',
  note: t('indstillinger.dosBonusNote'),
});

export const CATCH_UP: Regel = {
  id: 'catchUp',
  titel: t('indstillinger.catchUp'),
  status: catchUpStatus,
  sektioner: [
    {
      til: { noegle: 'catch_up_til', label: t('indstillinger.catchUp') },
      felter: [
        {
          art: 'tekst',
          noegle: 'catch_up_beloeb',
          label: t('indstillinger.beloeb'),
          enhed: kr,
          kind: 'integer',
          start: (ind) => String(ind.catch_up_beloeb),
          tjek: tjekBeloeb,
        },
        {
          art: 'tekst',
          noegle: 'catch_up_antal',
          label: t('indstillinger.catchUpAntal'),
          kind: 'integer',
          note: t('indstillinger.catchUpAntalNote'),
          start: (ind) => String(ind.catch_up_antal),
          tjek: tjekAntal,
        },
      ],
      note: t('indstillinger.catchUpNote'),
    },
  ],
};

export const SEN_BETALING: Regel = {
  id: 'senBetaling',
  titel: t('indstillinger.senBetaling'),
  status: senBetalingStatus,
  sektioner: [
    {
      til: { noegle: 'sen_betaling_til', label: t('indstillinger.senBetaling') },
      felter: [
        {
          art: 'tekst',
          noegle: 'sen_betaling_beloeb',
          label: t('indstillinger.senBetalingBeloeb'),
          enhed: kr,
          kind: 'integer',
          start: (ind) => String(ind.sen_betaling_beloeb),
          tjek: tjekBeloeb,
        },
        {
          art: 'tekst',
          noegle: 'betalingsdag',
          label: t('indstillinger.betalingsdag'),
          kind: 'integer',
          note: t('indstillinger.betalingsdagNote'),
          start: (ind) => String(ind.betalingsdag),
          tjek: tjekBetalingsdag,
        },
        {
          art: 'tekst',
          noegle: 'sen_betaling_loft',
          label: t('indstillinger.senBetalingLoft'),
          enhed: kr,
          kind: 'integer',
          note: t('indstillinger.senBetalingLoftNote'),
          start: (ind) => (ind.sen_betaling_loft === null ? '' : String(ind.sen_betaling_loft)),
          tjek: tjekLoft,
        },
      ],
      note: t('indstillinger.senBetalingNote'),
    },
  ],
};

/** "Når nogen gør noget": Gebyrer someone's action causes. */
export const GEBYRER_NAAR_NOGEN: readonly Regel[] = [OPRETTELSESGEBYR, ENGANGSGEBYR];

/** "Automatiske": Gebyrer the scheduler charges. */
export const GEBYRER_AUTOMATISKE: readonly Regel[] = [DOS_BONUS, CATCH_UP, SEN_BETALING];

// ── Status helpers: one per Gebyr ────────────────────────────────────────

/** Catch-up: "Til · De 2 laveste betaler 20 kr d. 1." */
export function catchUpStatus(
  ind: Pick<Indstillinger, 'catch_up_til' | 'catch_up_antal' | 'catch_up_beloeb'>,
): RegelStatus {
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
const GEBYR_SWITCHES: readonly TilNoegle[] = [...GEBYRER_NAAR_NOGEN, ...GEBYRER_AUTOMATISKE].flatMap((regel) =>
  regel.sektioner.flatMap((sektion) => (sektion.til ? [sektion.til.noegle] : [])),
);

/**
 * The hub's Gebyrer row: "3 slået til", or a muted "Ingen slået til".
 * Tilbagevendende Gebyrer have no switch, so they don't count.
 */
export function gebyrerStatus(ind: Partial<Pick<Indstillinger, TilNoegle>>): RegelStatus {
  const antal = GEBYR_SWITCHES.filter((noegle) => ind[noegle]).length;
  return antal === 0
    ? { til: false, tekst: t('indstillinger.gebyrerIngenSlaaetTil') }
    : { til: true, tekst: t('indstillinger.gebyrerSlaaetTil', { antal }) };
}
