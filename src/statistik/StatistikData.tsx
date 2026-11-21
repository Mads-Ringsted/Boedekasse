import { createContext, useContext, useMemo } from 'react';
import { kortNavne } from '../giv/navne.ts';
import { t } from '../strings/index.ts';
import type { StatData } from './hentStatistik.ts';

/** The Statistik tab's data plus the names and times every card needs. */
export interface Stat extends StatData {
  migId: string;
  /** "Dig" for you; else the first name (full name when two share it). */
  navn: (medlemId: string) => string;
  /** As `navn`, but "dig" mid-sentence. */
  navnObjekt: (medlemId: string) => string;
  /** The Bødekategori's name; "Engangsbøder" for null. */
  kategoriNavn: (kategoriId: string | null) => string;
  erUdmeldt: (medlemId: string) => boolean;
  /** The end of the Sæson shown, or now while it runs. */
  slut: string;
  /** The Sæson shown is still running. */
  koerer: boolean;
}

export const StatContext = createContext<Stat | null>(null);

export function useStat(): Stat {
  const s = useContext(StatContext);
  if (!s) throw new Error('useStat must be used inside Statistik');
  return s;
}

export function useBygStat(data: StatData | null, migId: string, nu: number): Stat | null {
  return useMemo(() => {
    if (!data) return null;
    const korte = kortNavne(data.medlemmer.map((m) => m.navn));
    const navne = new Map(data.medlemmer.map((m, i) => [m.id, korte[i]]));
    const udmeldte = new Set(data.medlemmer.filter((m) => m.udmeldt).map((m) => m.id));
    const kategorier = new Map(data.kategorier.map((k) => [k.id, k.navn]));
    const slutter = data.saeson?.slutter ? Date.parse(data.saeson.slutter) : null;
    const koerer = slutter === null || nu < slutter;
    return {
      ...data,
      migId,
      navn: (id) => (id === migId ? t('stat.dig') : (navne.get(id) ?? '')),
      navnObjekt: (id) => (id === migId ? t('stat.digObjekt') : (navne.get(id) ?? '')),
      kategoriNavn: (id) => (id === null ? t('stat.engangsboeder') : (kategorier.get(id) ?? '')),
      erUdmeldt: (id) => udmeldte.has(id),
      slut: new Date(koerer ? nu : (slutter as number)).toISOString(),
      koerer,
    };
  }, [data, migId, nu]);
}
