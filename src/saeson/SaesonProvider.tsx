import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useBodekasse } from '../bodekasse/BodekasseProvider.tsx';
import { supabase } from '../supabase/index.ts';
import { useHent } from '../supabase/useHent.ts';
import { koerer, msTilSlut, type Saeson } from './saeson.ts';

interface SaesonValue {
  /** The box's latest Sæson (the ended one in a Pause); null while loading. */
  saeson: Saeson | null;
  /** True in a Pause: no running Sæson. False while loading. */
  pause: boolean;
  /** Bumps after an Admin starts, ends or changes the Sæson. Add it to your reload deps. */
  version: number;
  /** Call after a Sæson RPC: reloads the Sæson and bumps `version`. */
  aendret: () => void;
}

const SaesonContext = createContext<SaesonValue | null>(null);

async function hentSaeson(bodekasseId: string): Promise<Saeson | null> {
  const { data, error } = await supabase
    .from('saeson_status')
    .select('id, navn, slutdato, slutter')
    .eq('bodekasse_id', bodekasseId)
    .eq('er_seneste', true)
    .maybeSingle();
  if (error) throw error;
  if (!data?.id) return null;
  return { id: data.id, navn: data.navn ?? '', slutdato: data.slutdato, slutter: data.slutter };
}

/**
 * The open box's latest Sæson and whether it is a Pause. The Sæson ends at a
 * set time, so this re-renders when that time passes, and reloads when the
 * app comes back to the front.
 */
export function SaesonProvider({ children }: { children: ReactNode }) {
  const { bodekasseId } = useBodekasse();
  const [version, setVersion] = useState(0);
  const hentet = useHent(() => hentSaeson(bodekasseId), [bodekasseId, version]);
  const saeson = hentet.status === 'ready' ? hentet.data : null;
  const [, setTik] = useState(0);
  const { reload } = hentet;

  // Flip to Pause the moment the Sæson ends (setTimeout caps at ~24.8 days).
  useEffect(() => {
    const ms = msTilSlut(saeson);
    if (ms === null || ms > 2_000_000_000) return;
    const timer = setTimeout(() => setTik((n) => n + 1), ms + 500);
    return () => clearTimeout(timer);
  }, [saeson]);

  useEffect(() => {
    const synlig = () => {
      if (document.visibilityState === 'visible') reload();
    };
    document.addEventListener('visibilitychange', synlig);
    return () => document.removeEventListener('visibilitychange', synlig);
  }, [reload]);

  const aendret = useCallback(() => setVersion((n) => n + 1), []);
  const pause = hentet.status === 'ready' && !koerer(saeson);
  const value = useMemo(() => ({ saeson, pause, version, aendret }), [saeson, pause, version, aendret]);
  return <SaesonContext.Provider value={value}>{children}</SaesonContext.Provider>;
}

export function useSaeson(): SaesonValue {
  const value = useContext(SaesonContext);
  if (!value) throw new Error('useSaeson must be used inside SaesonProvider');
  return value;
}
