import type { Gebyr, Haendelse } from './haendelse.ts';

/**
 * What a feed row shows, as plain data. Each entry kind (`art`) turns a
 * Haendelse into this in `arter/`; `FeedRaekke` draws it the same way for all.
 */
export interface Raekke {
  ikon: Ikon;
  titel: string;
  tag?: Tag;
  /** The grey second line, without the time (the feed adds "· 35 min" today). */
  linje: string;
  beloeb?: { tekst: string; tone?: 'groen' };
  /** Small text under the amount, e.g. "+10 kr gebyr". */
  gebyr?: string;
  /** Greyed with the amount struck through. */
  annulleret: boolean;
  /** Two or more Bøder: the row expands to list them. */
  boeder?: BoedeLinje[];
  /** Tapping the row opens this Bøde's detail sheet. */
  boedeId?: string;
  /**
   * A Gebyr an Admin may annul from this row (see `annullerbartGebyr`).
   * For Admins, tapping the row opens "Annullér gebyr".
   */
  annullerGebyr?: Gebyr;
  /** Tapping the row opens this screen (e.g. a Konkurrence's result). */
  link?: string;
}

/** One Bøde inside an expanded batch row. */
export interface BoedeLinje {
  id: string;
  navn: string;
  beloeb: string;
  tag?: Tag;
  annulleret: boolean;
  gebyr?: string;
}

export type Ikon =
  | { slags: 'avatar'; navn: string; egen?: boolean }
  /** A round icon tile; `FeedRaekke` maps the symbol to a lucide icon. */
  | { slags: 'symbol'; symbol: Symbol; tone?: 'graa' | 'groen' | 'blaa' };

/** Icon tiles. Add one here and in `FeedRaekke`'s SYMBOLER for a new kind. */
export type Symbol = 'kategori' | 'saeson' | 'trofae' | 'haevning';

export interface Tag {
  tekst: string;
  tone: 'advarsel' | 'graa' | 'blaa' | 'groen' | 'roed';
}

/** Who is looking: their own name reads "Du" / "dig". */
export interface Kontekst {
  migId: string;
  /** Set in a Medlem's history: the feed is filtered to them. */
  profilId?: string;
}

/** Describes one entry kind. Return null to leave the entry out. */
export type Beskriver = (h: Haendelse, ctx: Kontekst) => Raekke | null;
