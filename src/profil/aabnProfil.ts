import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router';
import type { PlainStringId } from '../strings/index.ts';

/** The profile route for a Medlem. Your own profile also lives at `/profil`. */
export const profilSti = (medlemId: string) => `/medlem/${medlemId}`;

interface ProfilState {
  /** The back button's label: the screen the profile was opened from. */
  fra: PlainStringId;
}

/**
 * Opens a Medlem's profile from a screen. `fra` is that screen's name, shown
 * on the profile's back button ("‹ Hjem", "‹ Medlemmer").
 */
export function useAabnProfil(fra: PlainStringId): (medlemId: string) => void {
  const navigate = useNavigate();
  return useCallback(
    (medlemId: string) => void navigate(profilSti(medlemId), { state: { fra } satisfies ProfilState }),
    [navigate, fra],
  );
}

/**
 * The profile's back button: back to where it was opened from, or to Hjem
 * when it was opened without one (a reload or a link).
 */
export function useProfilTilbage(): { label: PlainStringId; tilbage: () => void } {
  const navigate = useNavigate();
  const state = useLocation().state as Partial<ProfilState> | null;
  const fra = state?.fra;
  return {
    label: fra ?? 'tab.hjem',
    tilbage: () => void (fra ? navigate(-1) : navigate('/')),
  };
}
