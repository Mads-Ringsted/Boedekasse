import type { ComponentType } from 'react';
import { FrikobKort, KoebFrikobKnap } from '../frikob/profilDele.tsx';
import { BetalKnap, GivBoedeKnap, RegistrerIndbetalingKnap } from './knapper.tsx';
import type { Profil, ProfilVisning } from './profil.ts';

/** What every part added to a profile gets. */
export interface ProfilDelProps {
  /** Whose profile it is. */
  profil: Profil;
  /** Own profile or not, tags, Mangler / Til gode (see `profilVisning`). */
  visning: ProfilVisning;
  /** Who is looking. */
  mig: { medlemId: string; erAdmin: boolean };
  /** Something changed: reloads the profile's figures and its history. */
  opdater: () => void;
}

/**
 * One part of a profile: a component that renders itself (and any sheet it
 * opens), or null when it doesn't apply to this profile and person. It
 * decides that itself from `profil`, `visning` and `mig`.
 */
export type ProfilDel = ComponentType<ProfilDelProps>;

/**
 * The action buttons under the figures, in a 2-column grid (a lone button
 * fills the row). Render each with `<ProfilKnap>` from `knapper.tsx`.
 * - Someone else: Giv bøde, then Registrér indbetaling (Admin).
 * - Your own: Betal (#60 wires it), then Køb Frikøb (when Frikøb is on).
 * - Someone else, Admin: Registrér frikøb (the same Frikøb part).
 */
export const PROFIL_KNAPPER: readonly ProfilDel[] = [GivBoedeKnap, RegistrerIndbetalingKnap, BetalKnap, KoebFrikobKnap];

/**
 * Cards between the buttons and Historik, top to bottom. Use the
 * `.profil__kort` and `.profil__sektion` classes from `Profil.css`.
 * "Frikøb i sæson …" chips (#65); #63 adds "Kan ankes" (own profile).
 */
export const PROFIL_KORT: readonly ProfilDel[] = [FrikobKort];

/**
 * Small buttons at the top right, beside the back button.
 * #69 adds the Admin actions entry (opens "Handlinger for X"; its sheet holds
 * Registrér indbetaling, Registrér frikøb (#65), roles, Ret navn/email, Meld ud, Slet).
 */
export const PROFIL_TOP: readonly ProfilDel[] = [];
