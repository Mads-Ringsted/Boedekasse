import { engangsPris } from '../giv/engangsPris.ts';
import { parsePris } from '../kategorier/kategoriListe.ts';
import { parsePlaceringer } from '../konkurrence/raekkefoelge.ts';
import { formatKr, t } from '../strings/index.ts';
import {
  gangeTekst,
  parseBetalingsdag,
  parseGange,
  rensLoft,
  tjekEngangsPris,
  type EngangsPrisMode,
  type Indstillinger,
} from './indstillinger.ts';
import type { Regel, RegelStatus, Sektion, Tjekket } from './regel.ts';

export type { RegelStatus } from './regel.ts';

// ── Checks for typed settings ────────────────────────────────────────────

/** Whole kroner above 0. */
export function tjekBeloeb(tekst: string): Tjekket<number> {
  const beloeb = parsePris(tekst);
  return beloeb === null ? { ok: false, fejl: t('indstillinger.beloebUgyldig') } : { ok: true, vaerdi: beloeb };
}

/** Whole hours above 0 (the Ankefrist). */
export function tjekTimer(tekst: string): Tjekket<number> {
  const timer = parsePris(tekst);
  return timer === null ? { ok: false, fejl: t('indstillinger.timerUgyldig') } : { ok: true, vaerdi: timer };
}

/** A multiple of at least 1, "1,5" allowed (the largest Anke Gebyr). */
export function tjekGange(tekst: string): Tjekket<number> {
  const gange = parseGange(tekst);
  return gange === null ? { ok: false, fejl: t('indstillinger.gangeUgyldig') } : { ok: true, vaerdi: gange };
}

/** Kroner per place, comma separated. */
export function tjekPlaceringer(tekst: string): Tjekket<number[]> {
  const tabel = parsePlaceringer(tekst);
  return tabel === null ? { ok: false, fejl: t('indstillinger.placeringerUgyldig') } : { ok: true, vaerdi: tabel };
}

/** How many Medlemmer pay Catch-up: whole, above 0. */
export function tjekAntal(tekst: string): Tjekket<number> {
  const antal = parsePris(tekst);
  return antal === null ? { ok: false, fejl: t('indstillinger.catchUpAntalUgyldig') } : { ok: true, vaerdi: antal };
}

/** A Betalingsdag 1–28. */
export function tjekBetalingsdag(tekst: string): Tjekket<number> {
  const dag = parseBetalingsdag(tekst);
  return dag === null ? { ok: false, fejl: t('indstillinger.betalingsdagUgyldig') } : { ok: true, vaerdi: dag };
}

/** The Sen betaling cap: empty for none, else whole kroner above 0. */
export function tjekLoft(tekst: string): Tjekket<number | null> {
  const r = rensLoft(tekst);
  return r.ok ? r : { ok: false, fejl: t('indstillinger.beloebUgyldig') };
}

// ── Status helpers: one per rule ─────────────────────────────────────────

/** A rule's status from its switch and its summary. Off never shows an amount. */
export function regelStatus(til: boolean, resume: string): RegelStatus {
  return til ? { til, tekst: t('regel.til', { resume }) } : { til, tekst: t('regel.fra') };
}

/** "25 kr", or "0–50 kr" for amounts that differ. */
function spaendKr(beloeb: readonly number[]): string {
  const fra = Math.min(...beloeb);
  const til = Math.max(...beloeb);
  return fra === til ? formatKr(fra) : t('regel.spaend', { fra, til: formatKr(til) });
}

/** Anke: "Til · 24 timer" (the Ankefrist). */
export function ankeStatus(ind: Pick<Indstillinger, 'anke_til' | 'anke_vindue_timer'>): RegelStatus {
  return regelStatus(ind.anke_til, t('indstillinger.ankeVindueVaerdi', { timer: ind.anke_vindue_timer }));
}

/** Frikøb: "Til · 300 kr" (the price per Bødekategori). */
export function frikobStatus(ind: Pick<Indstillinger, 'frikob_til' | 'frikob_pris'>): RegelStatus {
  return regelStatus(ind.frikob_til, formatKr(ind.frikob_pris));
}

/** Konkurrencer: "Til · 0–50 kr · fravær 50 kr". */
export function konkurrenceStatus(
  ind: Pick<Indstillinger, 'konkurrence_til' | 'placeringer' | 'fravaersgebyr'>,
): RegelStatus {
  return regelStatus(
    ind.konkurrence_til,
    t('indstillinger.konkurrenceResume', {
      placeringer: spaendKr(ind.placeringer),
      fravaer: formatKr(ind.fravaersgebyr),
    }),
  );
}

/** The Engangsbøde price: "Fri", "Fast · 30 kr" or "Højst 50 kr". */
export function engangsPrisTekst(ind: Pick<Indstillinger, 'engangs_pris_mode' | 'engangs_pris'>): string {
  const pris = engangsPris(ind);
  if (pris.mode === 'fast') return t('indstillinger.engangsVaerdi.fast', { beloeb: formatKr(pris.beloeb) });
  if (pris.mode === 'loft') return t('indstillinger.engangsVaerdi.loft', { beloeb: formatKr(pris.loft) });
  return t('indstillinger.engangsMode.fri');
}

/**
 * Engangsbøder: the price, plus "· gebyr 10 kr" while the Gebyr is on.
 * Engangsbøder have no switch, so the row never says Fra.
 */
export function engangsStatus(
  ind: Pick<Indstillinger, 'engangs_pris_mode' | 'engangs_pris' | 'engangsgebyr_til' | 'engangsgebyr'>,
): RegelStatus {
  const pris = engangsPrisTekst(ind);
  return {
    til: true,
    tekst: ind.engangsgebyr_til
      ? t('indstillinger.engangsResumeGebyr', { pris, gebyr: formatKr(ind.engangsgebyr) })
      : pris,
  };
}

// ── The rules on the hub ─────────────────────────────────────────────────

const kr = t('kategori.kr');

export const ANKE: Regel = {
  id: 'anke',
  titel: t('indstillinger.anke'),
  status: ankeStatus,
  sektioner: [
    {
      til: { noegle: 'anke_til', label: t('indstillinger.anke') },
      felter: [
        {
          art: 'tekst',
          noegle: 'anke_vindue_timer',
          label: t('indstillinger.ankeVindue'),
          enhed: t('indstillinger.timer'),
          inputMode: 'numeric',
          note: t('indstillinger.ankeVindueNote'),
          start: (ind) => String(ind.anke_vindue_timer),
          tjek: tjekTimer,
        },
        {
          art: 'tekst',
          noegle: 'anke_min',
          label: t('indstillinger.ankeMin'),
          enhed: kr,
          inputMode: 'numeric',
          note: t('indstillinger.ankeMinNote'),
          start: (ind) => String(ind.anke_min),
          tjek: tjekBeloeb,
        },
        {
          art: 'tekst',
          noegle: 'anke_max_gange',
          label: t('indstillinger.ankeMax'),
          enhed: t('indstillinger.gangeBoeden'),
          inputMode: 'decimal',
          note: t('indstillinger.ankeMaxNote'),
          start: (ind) => gangeTekst(ind.anke_max_gange),
          tjek: tjekGange,
        },
      ],
    },
  ],
};

export const FRIKOB: Regel = {
  id: 'frikob',
  titel: t('indstillinger.frikob'),
  status: frikobStatus,
  sektioner: [
    {
      til: { noegle: 'frikob_til', label: t('indstillinger.frikob') },
      felter: [
        {
          art: 'tekst',
          noegle: 'frikob_pris',
          label: t('indstillinger.frikobPrisLabel'),
          enhed: kr,
          inputMode: 'numeric',
          note: t('indstillinger.frikobNote'),
          start: (ind) => String(ind.frikob_pris),
          tjek: tjekBeloeb,
        },
      ],
    },
  ],
};

export const KONKURRENCER: Regel = {
  id: 'konkurrencer',
  titel: t('indstillinger.konkurrencer'),
  status: konkurrenceStatus,
  sektioner: [
    {
      til: { noegle: 'konkurrence_til', label: t('indstillinger.konkurrencer') },
      felter: [
        {
          art: 'tekst',
          noegle: 'placeringer',
          label: t('indstillinger.placeringer'),
          enhed: kr,
          inputMode: 'decimal',
          note: t('indstillinger.placeringerNote'),
          start: (ind) => ind.placeringer.join(', '),
          tjek: tjekPlaceringer,
        },
        {
          art: 'tekst',
          noegle: 'fravaersgebyr',
          label: t('indstillinger.fravaersgebyr'),
          enhed: kr,
          inputMode: 'numeric',
          note: t('indstillinger.fravaersgebyrNote'),
          start: (ind) => String(ind.fravaersgebyr),
          tjek: tjekBeloeb,
        },
      ],
    },
  ],
};

const ENGANGS_MODES: readonly EngangsPrisMode[] = ['fri', 'fast', 'loft'];

/**
 * The Engangsbøde Gebyr: its switch and amount. The Engangsbøder sheet holds
 * it, and the Gebyrer page shows the same section as its own rule.
 */
export const ENGANGSGEBYR_SEKTION: Sektion = {
  titel: t('indstillinger.engangsGebyr'),
  til: { noegle: 'engangsgebyr_til', label: t('indstillinger.engangsgebyr') },
  felter: [
    {
      art: 'tekst',
      noegle: 'engangsgebyr',
      label: t('indstillinger.beloeb'),
      enhed: kr,
      inputMode: 'numeric',
      note: t('indstillinger.engangsgebyrNote'),
      start: (ind) => String(ind.engangsgebyr),
      tjek: tjekBeloeb,
    },
  ],
};

export const ENGANGSBOEDER: Regel = {
  id: 'engangsboeder',
  titel: t('indstillinger.engangsboeder'),
  status: engangsStatus,
  sektioner: [
    {
      titel: t('indstillinger.engangsPris'),
      felter: [
        {
          art: 'valg',
          noegle: 'engangs_pris_mode',
          label: t('indstillinger.engangsPrisTitel'),
          start: (ind) => ind.engangs_pris_mode,
          valg: ENGANGS_MODES.map((m) => ({
            vaerdi: m,
            navn: t(`indstillinger.engangsMode.${m}` as const),
            under: t(`indstillinger.engangsModeUnder.${m}` as const),
          })),
        },
        {
          art: 'tekst',
          noegle: 'engangs_pris',
          label: (laes) =>
            t(laes('engangs_pris_mode') === 'loft' ? 'indstillinger.engangsBeloeb.loft' : 'indstillinger.engangsBeloeb.fast'),
          enhed: kr,
          inputMode: 'numeric',
          start: (ind) => (ind.engangs_pris === null ? '' : String(ind.engangs_pris)),
          vis: (laes) => laes('engangs_pris_mode') !== 'fri',
          tjek: (tekst, laes) => {
            const r = tjekEngangsPris(laes('engangs_pris_mode') as EngangsPrisMode, tekst);
            if (!r.ok) {
              return {
                ok: false,
                fejl: t(r.fejl === 'mangler' ? 'indstillinger.engangsPrisMangler' : 'indstillinger.beloebUgyldig'),
              };
            }
            return { ok: true, vaerdi: r.aendringer.engangs_pris ?? null };
          },
        },
      ],
      note: t('indstillinger.engangsPrisNote'),
    },
    ENGANGSGEBYR_SEKTION,
  ],
};

/** The hub's Regler section, in order. */
export const REGLER: readonly Regel[] = [ANKE, FRIKOB, KONKURRENCER, ENGANGSBOEDER];
