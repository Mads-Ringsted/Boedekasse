import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useBodekasse } from '../bodekasse/BodekasseProvider.tsx';
import { supabase } from '../supabase/index.ts';
import { BilledFejlContext } from './billedFejl.ts';
import { FORNY_MARGIN_MS } from './billede.ts';
import { glemSigneret, signerBilleder, signeret } from './billeder.ts';

interface BillederValue {
  /** The signed picture URL of a Medlem in the open box; undefined = initials. */
  billede: (medlemId: string | null | undefined) => string | undefined;
  /** Load the box's pictures again, e.g. after `saetMitBillede` / `fjernMitBillede`. */
  opdater: () => void;
}

const INGEN: BillederValue = { billede: () => undefined, opdater: () => {} };
const BillederContext = createContext<BillederValue>(INGEN);

// Medlem id -> object path, for every Medlem in the box with a picture
// (Udmeldte included: they show greyed out).
async function hentStier(bodekasseId: string): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from('medlem')
    .select('id, billede_sti')
    .eq('bodekasse_id', bodekasseId)
    .not('billede_sti', 'is', null);
  if (error) throw error;
  return new Map(data.flatMap((m) => (m.billede_sti ? [[m.id, m.billede_sti] as const] : [])));
}

/**
 * The open box's Profilbilleder. Loads every Medlem's picture path and signs
 * them in one request; URLs are cached for the session and signed again
 * before they expire, when the app comes back to the front, and once after
 * a URL fails to load. On any error the avatars simply show initials.
 */
export function BilledProvider({ children }: { children: ReactNode }) {
  const { bodekasseId } = useBodekasse();
  const [runde, setRunde] = useState(0);
  const [stier, setStier] = useState<ReadonlyMap<string, string>>(new Map());
  const proevetIgen = useRef(new Set<string>());

  const opdater = useCallback(() => setRunde((n) => n + 1), []);

  useEffect(() => {
    let aktuel = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    (async () => {
      const nye = await hentStier(bodekasseId);
      await signerBilleder(nye.values());
      if (!aktuel) return;
      setStier(nye);
      // Sign again shortly before the first URL expires.
      const udloeb = [...nye.values()].map((s) => signeret(s)?.udloeber ?? Infinity);
      const ms = Math.min(...udloeb) - FORNY_MARGIN_MS / 2 - Date.now();
      if (Number.isFinite(ms)) timer = setTimeout(opdater, Math.max(ms, 60_000));
    })().catch(() => {});
    return () => {
      aktuel = false;
      clearTimeout(timer);
    };
  }, [bodekasseId, runde, opdater]);

  useEffect(() => {
    const synlig = () => {
      if (document.visibilityState === 'visible') opdater();
    };
    document.addEventListener('visibilitychange', synlig);
    return () => document.removeEventListener('visibilitychange', synlig);
  }, [opdater]);

  const meldFejl = useCallback(
    (url: string) => {
      const sti = [...stier.values()].find((s) => signeret(s)?.url === url);
      if (!sti || proevetIgen.current.has(sti)) return;
      proevetIgen.current.add(sti);
      glemSigneret(sti);
      opdater();
    },
    [stier, opdater],
  );

  const value = useMemo<BillederValue>(
    () => ({
      billede: (medlemId) => {
        const sti = medlemId ? stier.get(medlemId) : undefined;
        return sti ? signeret(sti)?.url : undefined;
      },
      opdater,
    }),
    [stier, opdater],
  );

  return (
    <BillederContext value={value}>
      <BilledFejlContext value={meldFejl}>{children}</BilledFejlContext>
    </BillederContext>
  );
}

/**
 * `billede(medlemId)` gives a Medlem's picture URL (`<Avatar medlemId>` uses
 * it), and `opdater()` reloads after a change. Outside the provider: no pictures.
 */
export function useBilleder(): BillederValue {
  return useContext(BillederContext);
}
