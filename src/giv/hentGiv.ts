import type { AktivtFrikob } from '../frikob/frikob.ts';
import { hentFrikoeb } from '../frikob/hentFrikoeb.ts';
import { hentKategorier, type Kategori } from '../kategorier/hentKategorier.ts';
import { kategoriListe } from '../kategorier/kategoriListe.ts';
import { supabase } from '../supabase/index.ts';
import { modtagerListe, type Modtager } from './navne.ts';

export type { Modtager } from './navne.ts';

export interface GivData {
  /** You first ("Dig"), then every other active Medlem A–Å. */
  modtagere: Modtager[];
  /** Active Bødekategorier: "Ofte brugt" first, then A–Å. */
  kategorier: Kategori[];
  /** Frikøb that block giving a Bødekategori to someone (#65). */
  frikoeb: AktivtFrikob[];
}

/** What Giv bøder shows: who you can fine (you too) and with what. */
export async function hentGiv(bodekasseId: string, mitMedlemId: string): Promise<GivData> {
  const [medlemmer, kategorier, frikoeb] = await Promise.all([
    supabase.from('medlem').select('id, navn, user_id, udmeldt').eq('bodekasse_id', bodekasseId),
    hentKategorier(bodekasseId),
    hentFrikoeb(bodekasseId),
  ]);
  if (medlemmer.error) throw medlemmer.error;

  return {
    modtagere: modtagerListe(medlemmer.data, mitMedlemId),
    kategorier: kategoriListe(kategorier, { soeg: '', sortering: 'navn' }).aktive,
    frikoeb,
  };
}
