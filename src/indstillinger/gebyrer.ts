import { formatKr, t } from '../strings/index.ts';
import type { Indstillinger } from './indstillinger.ts';
import type { Regel, RegelStatus, TilNoegle } from './regel.ts';
import { ENGANGSGEBYR_SEKTION, regelStatus, tjekAntal, tjekBeloeb, tjekBetalingsdag, tjekLoft } from './regler.ts';

/**
 * The Gebyrer page (#95): its rules and their status helpers. Each Gebyr is a
 * `Regel`, so `RegelRaekke` and `RegelSheet` draw it like the hub's rules.
 */

// ── The rules ────────────────────────────────────────────────────────────

const kr = t('kategori.kr');

export const OPRETTELSESGEBYR: Regel = {
  id: 'oprettelsesgebyr',
  titel: t('indstillinger.oprettelsesgebyr'),
  status: oprettelsesgebyrStatus,
  sektioner: [
    {
      til: { noegle: 'oprettelsesgebyr_til', label: t('indstillinger.oprettelsesgebyr') },
      felter: [
        {
          art: 'tekst',
          noegle: 'oprettelsesgebyr',
          label: t('indstillinger.beloeb'),
          enhed: kr,
          inputMode: 'numeric',
          note: t('indstillinger.oprettelsesgebyrNote'),
          start: (ind) => String(ind.oprettelsesgebyr),
          tjek: tjekBeloeb,
        },
      ],
    },
  ],
};

/** The same setting as in the Engangsbøder sheet; one section, so no heading. */
export const ENGANGSGEBYR: Regel = {
  id: 'engangsgebyr',
  titel: t('indstillinger.engangsgebyr'),
  status: engangsgebyrStatus,
  sektioner: [{ ...ENGANGSGEBYR_SEKTION, titel: undefined }],
};

export const DOS_BONUS: Regel = {
  id: 'dosBonus',
  titel: t('indstillinger.dosBonus'),
  status: dosBonusStatus,
  sektioner: [
    {
      til: { noegle: 'dos_bonus_til', label: t('indstillinger.dosBonus') },
      felter: [
        {
          art: 'tekst',
          noegle: 'dos_bonus_beloeb',
          label: t('indstillinger.beloeb'),
          enhed: kr,
          inputMode: 'numeric',
          note: t('indstillinger.dosBonusNote'),
          start: (ind) => String(ind.dos_bonus_beloeb),
          tjek: tjekBeloeb,
        },
      ],
    },
  ],
};

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
          inputMode: 'numeric',
          start: (ind) => String(ind.catch_up_beloeb),
          tjek: tjekBeloeb,
        },
        {
          art: 'tekst',
          noegle: 'catch_up_antal',
          label: t('indstillinger.catchUpAntal'),
          inputMode: 'numeric',
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
          inputMode: 'numeric',
          start: (ind) => String(ind.sen_betaling_beloeb),
          tjek: tjekBeloeb,
        },
        {
          art: 'tekst',
          noegle: 'betalingsdag',
          label: t('indstillinger.betalingsdag'),
          inputMode: 'numeric',
          note: t('indstillinger.betalingsdagNote'),
          start: (ind) => String(ind.betalingsdag),
          tjek: tjekBetalingsdag,
        },
        {
          art: 'tekst',
          noegle: 'sen_betaling_loft',
          label: t('indstillinger.senBetalingLoft'),
          enhed: kr,
          inputMode: 'numeric',
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

/** Ny bødekategori: "Til · 25 kr". */
export function oprettelsesgebyrStatus(
  ind: Pick<Indstillinger, 'oprettelsesgebyr_til' | 'oprettelsesgebyr'>,
): RegelStatus {
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
