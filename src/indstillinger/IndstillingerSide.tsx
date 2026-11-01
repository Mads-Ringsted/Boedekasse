import { useState, type ReactNode } from 'react';
import { Navigate } from 'react-router';
import { useBodekasse } from '../bodekasse/BodekasseProvider.tsx';
import { t } from '../strings/index.ts';
import { rpcErrorText } from '../supabase/rpcErrors.ts';
import type { Regel } from './regel.ts';
import { RegelSheet } from './RegelSheet.tsx';
import { useIndstillinger } from './useIndstillinger.ts';
import './Indstillinger.css';

/** The Indstillinger pages are for Admins; anyone else goes to Mere. */
export function KunAdmin({ children }: { children: ReactNode }) {
  const { erAdmin } = useBodekasse();
  return erAdmin ? children : <Navigate to="/mere" replace />;
}

/**
 * What the Indstillinger hub and the Gebyrer page share: the settings, their
 * load error as a "Prøv igen" button, and one rule sheet at a time. Place
 * `fejl` under the title and `regelSheet` anywhere on the page; each
 * `aabnRegel` mounts a fresh sheet (new fields, new one-time ID).
 */
export function useIndstillingerSide() {
  const indstillinger = useIndstillinger();
  const { status, error, reload, indstillinger: ind, gem } = indstillinger;
  const [aaben, setAaben] = useState<{ n: number; open: boolean; regel: Regel } | null>(null);

  function aabnRegel(regel: Regel) {
    setAaben((s) => ({ n: (s?.n ?? 0) + 1, open: true, regel }));
  }

  const fejl = status === 'error' && (
    <button type="button" className="indst__fejl" onClick={reload}>
      {rpcErrorText(error)} · {t('handling.proevIgen')}
    </button>
  );

  const regelSheet = aaben && ind && (
    <RegelSheet
      key={aaben.n}
      open={aaben.open}
      onOpenChange={(open) => setAaben((s) => s && { ...s, open })}
      regel={aaben.regel}
      indstillinger={ind}
      gem={gem}
    />
  );

  return { ...indstillinger, fejl, aabnRegel, regelSheet };
}
