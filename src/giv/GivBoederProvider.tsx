import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { FortrydToast } from './FortrydToast.tsx';
import { GivBoeder, type Givet } from './GivBoeder.tsx';

/** What to start Giv bøder with. */
export interface Forvalg {
  /** "Giv denne bøde" on a Bødekategori: one of it to everyone picked. */
  kategoriId?: string;
  /** "Giv bøde" on a profile (#56): this person picked, starting on Hvad. */
  medlemId?: string;
}

interface GivBoederApi {
  /** Opens Giv bøder, optionally pre-filled. */
  aabn: (forvalg?: Forvalg) => void;
  /**
   * Goes up after Bøder are given or undone. Put it in a screen's `useHent`
   * deps to show the new numbers (Hjem, Kategorier, Aktivitet …).
   */
  version: number;
}

const GivBoederContext = createContext<GivBoederApi | null>(null);

export function useGivBoeder(): GivBoederApi {
  const api = useContext(GivBoederContext);
  if (!api) throw new Error('useGivBoeder must be used inside GivBoederProvider');
  return api;
}

/**
 * Owns the Giv bøder sheet and the Fortryd toast for the whole box, so the
 * flow can be opened from the tab bar or any screen.
 */
export function GivBoederProvider({ children }: { children: ReactNode }) {
  // Each opening gets a new key, so the selection and one-time ID start fresh;
  // the last one stays mounted while it animates closed.
  const [aabning, setAabning] = useState<{ nr: number; forvalg: Forvalg } | null>(null);
  const [aaben, setAaben] = useState(false);
  const [givet, setGivet] = useState<Givet | null>(null);
  const [version, setVersion] = useState(0);

  const aabn = useCallback((forvalg: Forvalg = {}) => {
    setAabning((a) => ({ nr: (a?.nr ?? 0) + 1, forvalg }));
    setAaben(true);
  }, []);

  const api = useMemo(() => ({ aabn, version }), [aabn, version]);

  return (
    <GivBoederContext.Provider value={api}>
      {children}
      {aabning && (
        <GivBoeder
          key={aabning.nr}
          open={aaben}
          onOpenChange={setAaben}
          forvalg={aabning.forvalg}
          onGivet={(g) => {
            setAaben(false);
            setGivet(g);
            setVersion((v) => v + 1);
          }}
        />
      )}
      {givet && (
        <FortrydToast
          key={givet.batchId}
          givet={givet}
          onLuk={() => setGivet(null)}
          onFortrudt={() => setVersion((v) => v + 1)}
        />
      )}
    </GivBoederContext.Provider>
  );
}
