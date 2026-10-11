import type { AktivtFrikob } from '../frikob/frikob.ts';
import { hentFrikoeb } from '../frikob/hentFrikoeb.ts';
import { hentKategorier, type Kategori } from '../kategorier/hentKategorier.ts';
import { kategoriListe } from '../kategorier/kategoriListe.ts';
import { supabase } from '../supabase/index.ts';
import { kortNavne } from './navne.ts';

/** A person you can give Bøder to. */
export interface Modtager {
  id: string;
  navn: string;
  /** First name, or the full name when another Medlem shares it. */
  kortNavn: string;
  /** False for a pre-added Medlem who has not logged in yet (dashed avatar). */
  loggetInd: boolean;
}

export interface GivData {
  /** Every active Medlem but you, A–Å. */
  modtagere: Modtager[];
  /** Active Bødekategorier: "Ofte brugt" first, then A–Å. */
  kategorier: Kategori[];
  /** Frikøb that block giving a Bødekategori to someone (#65). */
  frikoeb: AktivtFrikob[];
}

const dansk = new Intl.Collator('da');

/** What Giv bøder shows: who you can fine and with what. */
export async function hentGiv(bodekasseId: string, mitMedlemId: string): Promise<GivData> {
  const [medlemmer, kategorier, frikoeb] = await Promise.all([
    supabase.from('medlem').select('id, navn, user_id, udmeldt').eq('bodekasse_id', bodekasseId),
    hentKategorier(bodekasseId),
    hentFrikoeb(bodekasseId),
  ]);
  if (medlemmer.error) throw medlemmer.error;

  const andre = medlemmer.data
    .filter((m) => m.udmeldt === null && m.id !== mitMedlemId)
    .sort((a, b) => dansk.compare(a.navn, b.navn));
  const korte = kortNavne(andre.map((m) => m.navn));
  return {
    modtagere: andre.map((m, i) => ({ id: m.id, navn: m.navn, kortNavn: korte[i], loggetInd: m.user_id !== null })),
    kategorier: kategoriListe(kategorier, { soeg: '', sortering: 'navn' }).aktive,
    frikoeb,
  };
}
