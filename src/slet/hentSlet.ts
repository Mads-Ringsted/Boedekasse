import { supabase } from '../supabase/index.ts';

/** How many active Medlemmer lose the box ("forsvinder for alle 8"). */
export async function hentAntalMedlemmer(bodekasseId: string): Promise<number> {
  const { count, error } = await supabase
    .from('medlem')
    .select('id', { count: 'exact', head: true })
    .eq('bodekasse_id', bodekasseId)
    .is('udmeldt', null);
  if (error) throw error;
  return count ?? 0;
}

/** Admin only: deletes the box for everyone. Throws the RPC error (e.g. `navn_passer_ikke`). */
export async function sletBodekasse(klientId: string, bodekasseId: string, navn: string): Promise<void> {
  const { error } = await supabase.rpc('slet_bodekasse', {
    p_klient_id: klientId,
    p_bodekasse: bodekasseId,
    p_navn: navn,
  });
  if (error) throw error;
}

/** The names of the boxes where you are the last Admin. Slet konto waits until this is empty. */
export async function hentSidsteAdminKasser(): Promise<string[]> {
  const { data, error } = await supabase.from('sidste_admin_kasse').select('navn').order('navn');
  if (error) throw error;
  return data.map((k) => k.navn ?? '');
}

/** Deletes your login; your Medlemmer stay as unclaimed spots. Throws the RPC error (e.g. `sidste_admin`). */
export async function sletKonto(klientId: string): Promise<void> {
  const { error } = await supabase.rpc('slet_konto', { p_klient_id: klientId });
  if (error) throw error;
}
