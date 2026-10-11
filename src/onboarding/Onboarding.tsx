import { createContext, useContext } from 'react';

/** The two ways into a box: Opret Bødekasse and Jeg har en kode. */
export type OnboardingSide = 'opret' | 'kode';

const OnboardingContext = createContext<((side: OnboardingSide) => void) | null>(null);

export const OnboardingProvider = OnboardingContext.Provider;

/**
 * Opens Opret Bødekasse or Jeg har en kode as a full screen over the app,
 * from anywhere below `BoxGate` (Velkommen, Vælg, the switch sheet, Mere).
 */
export function useVisOnboarding(): (side: OnboardingSide) => void {
  const vis = useContext(OnboardingContext);
  if (!vis) throw new Error('useVisOnboarding must be used inside <OnboardingProvider>');
  return vis;
}
