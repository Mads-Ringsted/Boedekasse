import { supabase } from '../supabase/index.ts';
import type { ListeKategori } from './kategoriListe.ts';

/** One Bødekategori as the Kategorier screen and its sheets show it. */
export interface Kategori extends ListeKategori {
  beskrivelse: string | null;
  oprettetAf: string;
  oprettetAfNavn: string;
  oprettet: string;
}

/**
 * Every Bødekategori in the box (archived too), with this Sæson's use count
 * and "Ofte brugt" flag. In a Pause, "this Sæson" is the latest one.
 */
export async function hentKategorier(bodekasseId: string): Promise<Kategori[]> {
  const [kategorier, medlemmer, saeson] = await Promise.all([
    supabase
      .from('bodekategori')
      .select('id, navn, pris, beskrivelse, arkiveret, oprettet_af, oprettet')
      .eq('bodekasse_id', bodekasseId),
    supabase.from('medlem').select('id, navn').eq('bodekasse_id', bodekasseId),
    supabase.from('bodekasse_saeson').select('seneste_saeson_id').eq('bodekasse_id', bodekasseId).maybeSingle(),
  ]);
  if (kategorier.error) throw kategorier.error;
  if (medlemmer.error) throw medlemmer.error;
  if (saeson.error) throw saeson.error;

  const saesonId = saeson.data?.seneste_saeson_id;
  const brug = new Map<string, { antal: number; ofteBrugt: boolean }>();
  if (saesonId) {
    const svar = await supabase
      .from('bodekategori_brug')
      .select('bodekategori_id, antal, ofte_brugt')
      .eq('saeson_id', saesonId);
    if (svar.error) throw svar.error;
    for (const b of svar.data) {
      if (b.bodekategori_id) brug.set(b.bodekategori_id, { antal: b.antal ?? 0, ofteBrugt: b.ofte_brugt ?? false });
    }
  }

  const navne = new Map(medlemmer.data.map((m) => [m.id, m.navn]));
  return kategorier.data.map((k) => ({
    id: k.id,
    navn: k.navn,
    pris: k.pris,
    beskrivelse: k.beskrivelse,
    arkiveret: k.arkiveret !== null,
    oprettetAf: k.oprettet_af,
    oprettetAfNavn: navne.get(k.oprettet_af) ?? '',
    oprettet: k.oprettet,
    antal: brug.get(k.id)?.antal ?? 0,
    ofteBrugt: brug.get(k.id)?.ofteBrugt ?? false,
  }));
}
