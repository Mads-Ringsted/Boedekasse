import type { ComponentType } from 'react';
import type { Boede } from '../haendelse.ts';

/** What every action on the Bøde detail sheet gets. */
export interface BoedeHandlingProps {
  boede: Boede;
  /** Who is looking. */
  mig: { medlemId: string; erAdmin: boolean };
  /** Closes the sheet. */
  luk: () => void;
  /** The Bøde changed: reloads the sheet and every feed. */
  aendret: () => void;
}

/**
 * One action on the Bøde detail sheet: a component that renders its button
 * (and any sheet it opens), or null when it doesn't apply to this Bøde and
 * person. It decides that itself from `boede` and `mig`.
 */
export type BoedeHandling = ComponentType<BoedeHandlingProps>;

/**
 * The actions, top to bottom, in the sheet's action area.
 * #63 adds "Anke bøden" (first), #62 "Annullér bøde", #64 the verdict ones.
 * Write each in its own file next to this one and add it here.
 */
export const BOEDE_HANDLINGER: readonly BoedeHandling[] = [];
