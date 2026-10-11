import type { ComponentType } from 'react';
import { AendrAfgoerelse } from '../../anke/AendrAfgoerelse.tsx';
import { AfgoerAnke } from '../../anke/AfgoerAnke.tsx';
import { AnkeBoede } from '../../anke/AnkeBoede.tsx';
import type { AnkeRegler } from '../../anke/anke.ts';
import type { Boede } from '../haendelse.ts';
import { AnnullerBoede } from './AnnullerBoede.tsx';

/** What every action on the Bøde detail sheet gets. */
export interface BoedeHandlingProps {
  boede: Boede;
  /** Who is looking. */
  mig: { medlemId: string; erAdmin: boolean };
  /** The Bøde is from the box's latest Sæson (annulments and verdicts work only there). */
  iSenesteSaeson: boolean;
  /** The box's Anke settings and running Sæson (for "Anke bøden"). */
  ankeRegler: AnkeRegler | null;
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
 * "Anke bøden" (#63), the verdict and "Ændr afgørelse" (#64), then
 * "Annullér bøde" (#62).
 * Write each in its own file next to this one and add it here.
 */
export const BOEDE_HANDLINGER: readonly BoedeHandling[] = [AnkeBoede, AfgoerAnke, AendrAfgoerelse, AnnullerBoede];
