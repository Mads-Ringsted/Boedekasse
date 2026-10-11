import { supabase } from '../supabase/index.ts';
import type { EksportRaekke } from './eksport.ts';

export interface EksportSaeson {
  id: string;
  navn: string;
  koerer: boolean;
}

/** The box's Sæsoner, newest first. */
export async function hentSaesoner(bodekasseId: string): Promise<EksportSaeson[]> {
  const { data, error } = await supabase
    .from('saeson_status')
    .select('id, navn, koerer')
    .eq('bodekasse_id', bodekasseId)
    .order('loebenr', { ascending: false });
  if (error) throw error;
  return data.flatMap((s) => (s.id ? [{ id: s.id, navn: s.navn ?? '', koerer: s.koerer === true }] : []));
}

/** Every Bøde, Gebyr, Indbetaling and Hævning of one Sæson (Admin only). */
export async function hentEksport(bodekasseId: string, saesonId: string): Promise<EksportRaekke[]> {
  const { data, error } = await supabase.rpc('eksport_saeson', { p_bodekasse: bodekasseId, p_saeson: saesonId });
  if (error) throw error;
  return data;
}

/**
 * Hands the file to the phone: the share sheet ("Gem i Filer", Mail, …)
 * where it can take files, else a plain download.
 */
export async function gemFil(filnavn: string, indhold: string): Promise<void> {
  const fil = new File([indhold], filnavn, { type: 'text/csv;charset=utf-8' });
  if (navigator.canShare?.({ files: [fil] })) {
    try {
      await navigator.share({ files: [fil] });
      return;
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return; // closed the share sheet
      // NotAllowedError (the tap is too long ago after the fetch): download instead.
    }
  }
  const url = URL.createObjectURL(fil);
  const a = document.createElement('a');
  a.href = url;
  a.download = filnavn;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
