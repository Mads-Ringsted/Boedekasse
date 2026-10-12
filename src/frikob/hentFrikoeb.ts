import { hentSenesteSaeson } from '../aktivitet/hentAktivitet.ts';
import { hentIndstillinger } from '../indstillinger/hentIndstillinger.ts';
import { hentKategorier, type Kategori } from '../kategorier/hentKategorier.ts';
import { kategoriListe } from '../kategorier/kategoriListe.ts';
import { supabase } from '../supabase/index.ts';
import type { AktivtFrikob } from './frikob.ts';

/**
 * The Frikøb that cover someone now (latest Sæson, not annulled), oldest
 * first. Narrow it to one Medlem or one Bødekategori.
 */
export async function hentFrikoeb(
  bodekasseId: string,
  { medlemId, bodekategoriId }: { medlemId?: string; bodekategoriId?: string } = {},
): Promise<AktivtFrikob[]> {
  let q = supabase
    .from('frikob_aktiv')
    .select('id, medlem_id, medlem_navn, bodekategori_id, bodekategori_navn, koebt, pris')
    .eq('bodekasse_id', bodekasseId)
    .order('koebt');
  if (medlemId) q = q.eq('medlem_id', medlemId);
  if (bodekategoriId) q = q.eq('bodekategori_id', bodekategoriId);
  const { data, error } = await q;
  if (error) throw error;
  return data.map((f) => ({
    id: f.id ?? '',
    medlemId: f.medlem_id ?? '',
    medlemNavn: f.medlem_navn ?? '',
    bodekategoriId: f.bodekategori_id ?? '',
    bodekategoriNavn: f.bodekategori_navn ?? '',
    koebt: f.koebt ?? '',
    pris: f.pris ?? 0,
  }));
}

/** The latest Sæson's name and end date ("Frikøb i sæson 2026", "Gælder til"). */
export interface FrikobSaeson {
  navn: string;
  /** 'YYYY-MM-DD', or null when no end date is set. */
  slutdato: string | null;
}

export interface FrikobStatus {
  /** Frikøb is on and a Sæson runs: Køb Frikøb / Registrér frikøb can be offered. */
  kanKoebe: boolean;
  pris: number;
  saeson: FrikobSaeson | null;
  /** The Medlem's Frikøb now. */
  frikoeb: AktivtFrikob[];
}

/** One Medlem's Frikøb, the price, and whether a new one can be bought now. */
export async function hentFrikobStatus(bodekasseId: string, medlemId: string): Promise<FrikobStatus> {
  const [{ indstillinger, pause }, frikoeb, saeson] = await Promise.all([
    hentIndstillinger(bodekasseId),
    hentFrikoeb(bodekasseId, { medlemId }),
    supabase
      .from('saeson_status')
      .select('navn, slutdato')
      .eq('bodekasse_id', bodekasseId)
      .eq('er_seneste', true)
      .maybeSingle(),
  ]);
  if (saeson.error) throw saeson.error;
  return {
    kanKoebe: indstillinger.frikob_til && !pause,
    pris: indstillinger.frikob_pris,
    saeson: saeson.data ? { navn: saeson.data.navn ?? '', slutdato: saeson.data.slutdato } : null,
    frikoeb,
  };
}

export interface KoebValg extends Kategori {
  /** Bøder of this Bødekategori the Medlem has had this Sæson. */
  faaet: number;
  /** Already bought out (disabled). */
  koebt: boolean;
}

/** Køb Frikøb step 1: every active Bødekategori, and how many the Medlem has had. */
export async function hentKoebValg(
  bodekasseId: string,
  medlemId: string,
  frikoeb: readonly AktivtFrikob[],
): Promise<KoebValg[]> {
  const [kategorier, saesonId] = await Promise.all([hentKategorier(bodekasseId), hentSenesteSaeson(bodekasseId)]);
  const faaet = new Map<string, number>();
  if (saesonId) {
    const { data, error } = await supabase
      .from('bode')
      .select('bodekategori_id')
      .eq('saeson_id', saesonId)
      .eq('modtager_id', medlemId)
      .is('annulleret', null);
    if (error) throw error;
    for (const b of data) {
      if (b.bodekategori_id) faaet.set(b.bodekategori_id, (faaet.get(b.bodekategori_id) ?? 0) + 1);
    }
  }
  const koebte = new Set(frikoeb.map((f) => f.bodekategoriId));
  return kategoriListe(kategorier, { soeg: '', sortering: 'navn' }).aktive.map((k) => ({
    ...k,
    faaet: faaet.get(k.id) ?? 0,
    koebt: koebte.has(k.id),
  }));
}
