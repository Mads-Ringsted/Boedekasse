import type { ComponentType } from 'react';
import { FrikobKort, KoebFrikobKnap } from '../frikob/profilDele.tsx';
import { AdminHandlingerKnap } from '../medlemmer/AdminHandlinger.tsx';
import { BetalKnap, GivBoedeKnap, RegistrerIndbetalingKnap } from './knapper.tsx';
import type { Profil, ProfilVisning } from './profil.ts';
import { VenterPaaDigKort } from './VenterPaaDigKort.tsx';

/** What every part added to a profile gets. */
export interface ProfilDelProps {
  /** Whose profile it is. */
  profil: Profil;
  /** Own profile or not, tags, Mangler / Til gode (see `profilVisning`). */
  visning: ProfilVisning;
  /** Who is looking. `kanHaandterePenge`: Admin or Kasserer. */
  mig: { medlemId: string; erAdmin: boolean; kanHaandterePenge: boolean };
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
 * - Your own: Betal and Køb Frikøb (when Frikøb is on), then Giv bøde as the secondary one.
 * - Someone else: Giv bøde, then Registrér indbetaling (Admin or Kasserer).
 */
export const PROFIL_KNAPPER: readonly ProfilDel[] = [BetalKnap, KoebFrikobKnap, GivBoedeKnap, RegistrerIndbetalingKnap];

/**
 * Cards between the buttons and Historik, top to bottom. Use the
 * `.profil__kort` and `.profil__sektion` classes from `Profil.css`.
 * "Venter på dig" (own profile: your Betalingsmelding that afventer and the
 * Bøder you can appeal), then the "Frikøb i sæson …" chips (#65). Nothing
 * goes below Historik.
 */
export const PROFIL_KORT: readonly ProfilDel[] = [VenterPaaDigKort, FrikobKort];

/**
 * Small buttons at the top right, beside the back button.
 * Admin actions (#69, `AdminHandlingerKnap`): opens "Handlinger for X" with
 * Registrér indbetaling, roles, Ret navn/email, Meld ud / Genoptag and Slet.
 * Registrér frikøb (#65) is a profile button (`KoebFrikobKnap`), not a row here.
 */
export const PROFIL_TOP: readonly ProfilDel[] = [AdminHandlingerKnap];
