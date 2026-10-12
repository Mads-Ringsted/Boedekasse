import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useUser } from '../auth/AuthProvider.tsx';
import { supabase } from '../supabase/index.ts';
import { destinationAfterLogin, type Destination } from './destination.ts';
import { loadLastUsed, saveLastUsed } from './lastUsed.ts';

/** The logged-in person's spot in one box. */
export interface Medlemskab {
  medlemId: string;
  navn: string;
  erAdmin: boolean;
  bodekasseId: string;
  bodekasseNavn: string;
}

export type MedlemskaberLoad =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; medlemskaber: Medlemskab[] };

interface MedlemskaberValue {
  load: MedlemskaberLoad;
  /** Where the app should be: Velkommen, a box, or Vælg Bødekasse. Null while loading. */
  destination: Destination | null;
  /** Open another box (and remember it on this device). */
  switchTo: (bodekasseId: string) => void;
  /** Fetch the boxes again, e.g. after Opret Bødekasse or joining by code. */
  reload: () => Promise<void>;
}

const MedlemskaberContext = createContext<MedlemskaberValue | null>(null);

async function fetchMedlemskaber(userId: string): Promise<Medlemskab[]> {
  const { data, error } = await supabase
    .from('medlem')
    .select('id, navn, er_admin, bodekasse_id, bodekasse!medlem_bodekasse_id_fkey(navn)')
    .eq('user_id', userId)
    .is('udmeldt', null)
    .order('oprettet');
  if (error) throw error;
  return data.map((m) => ({
    medlemId: m.id,
    navn: m.navn,
    erAdmin: m.er_admin,
    bodekasseId: m.bodekasse_id,
    bodekasseNavn: m.bodekasse.navn,
  }));
}

/**
 * Loads the boxes the logged-in person is in (claimed spots included) and
 * picks the one to show. Mount it below the logged-in branch, keyed by user.
 */
export function BodekasseProvider({ children }: { children: ReactNode }) {
  const user = useUser();
  const [load, setLoad] = useState<MedlemskaberLoad>({ status: 'loading' });
  const [chosen, setChosen] = useState(loadLastUsed);
  const statusRef = useRef(load.status);
  statusRef.current = load.status;

  const reload = useCallback(async () => {
    try {
      setLoad({ status: 'ready', medlemskaber: await fetchMedlemskaber(user.id) });
    } catch {
      setLoad({ status: 'error' });
    }
  }, [user.id]);

  useEffect(() => {
    void reload();
    const onOnline = () => {
      if (statusRef.current === 'error') void reload();
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [reload]);

  const destination = useMemo(
    () =>
      load.status === 'ready'
        ? destinationAfterLogin(
            load.medlemskaber.map((m) => m.bodekasseId),
            chosen,
          )
        : null,
    [load, chosen],
  );

  const openId = destination?.kind === 'bodekasse' ? destination.bodekasseId : null;
  useEffect(() => {
    if (openId) saveLastUsed(openId);
  }, [openId]);

  const value = useMemo<MedlemskaberValue>(
    () => ({
      load,
      destination,
      switchTo: (bodekasseId) => {
        saveLastUsed(bodekasseId);
        setChosen(bodekasseId);
      },
      reload,
    }),
    [load, destination, reload],
  );

  return <MedlemskaberContext value={value}>{children}</MedlemskaberContext>;
}

/** All the person's boxes, the current destination, switchTo and reload. */
export function useMedlemskaber(): MedlemskaberValue {
  const value = useContext(MedlemskaberContext);
  if (!value) throw new Error('useMedlemskaber must be used inside <BodekasseProvider>');
  return value;
}

/** The open box and the person's Medlem in it. Use only inside a box's screens. */
export function useBodekasse(): Medlemskab {
  const { load, destination } = useMedlemskaber();
  const open =
    load.status === 'ready' && destination?.kind === 'bodekasse'
      ? load.medlemskaber.find((m) => m.bodekasseId === destination.bodekasseId)
      : undefined;
  if (!open) throw new Error('useBodekasse needs an open Bødekasse');
  return open;
}
