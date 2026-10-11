import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { BoedeDetaljeSheet } from './BoedeDetaljeSheet.tsx';

interface BoedeDetaljeApi {
  /** Opens the Bøde detail sheet for this Bøde. */
  aabn: (boedeId: string) => void;
  /**
   * Goes up when an action on the sheet changed a Bøde (annulled, appealed …).
   * Put it in a screen's `useHent` deps, next to `useGivBoeder().version`.
   */
  version: number;
  /** Call after anything else changed a Bøde or Gebyr (e.g. a Gebyr annulled from a feed row). */
  aendret: () => void;
}

const BoedeDetaljeContext = createContext<BoedeDetaljeApi | null>(null);

export function useBoedeDetalje(): BoedeDetaljeApi {
  const api = useContext(BoedeDetaljeContext);
  if (!api) throw new Error('useBoedeDetalje must be used inside BoedeDetaljeProvider');
  return api;
}

/** Owns the one Bøde detail sheet, so any screen can open a Bøde by id. */
export function BoedeDetaljeProvider({ children }: { children: ReactNode }) {
  // A new key per opening, so each opening loads fresh; the last one stays
  // mounted while it animates closed.
  const [aabning, setAabning] = useState<{ nr: number; boedeId: string } | null>(null);
  const [aaben, setAaben] = useState(false);
  const [version, setVersion] = useState(0);

  const aabn = useCallback((boedeId: string) => {
    setAabning((a) => ({ nr: (a?.nr ?? 0) + 1, boedeId }));
    setAaben(true);
  }, []);
  const aendret = useCallback(() => setVersion((v) => v + 1), []);

  const api = useMemo(() => ({ aabn, version, aendret }), [aabn, version, aendret]);

  return (
    <BoedeDetaljeContext.Provider value={api}>
      {children}
      {aabning && (
        <BoedeDetaljeSheet
          key={aabning.nr}
          boedeId={aabning.boedeId}
          open={aaben}
          onOpenChange={setAaben}
          onAendret={aendret}
        />
      )}
    </BoedeDetaljeContext.Provider>
  );
}
