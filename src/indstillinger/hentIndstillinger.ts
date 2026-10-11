import { supabase } from '../supabase/index.ts';
import type { IndstillingAendringer, Indstillinger } from './indstillinger.ts';

export interface HentetIndstillinger {
  indstillinger: Indstillinger;
  /** No Sæson runs: Gebyrer that need one (e.g. the creation Gebyr) are skipped. */
  pause: boolean;
}

/** The box's settings (any Medlem may read them) and whether it is in a Pause. */
export async function hentIndstillinger(bodekasseId: string): Promise<HentetIndstillinger> {
  const [kasse, saeson] = await Promise.all([
    supabase.from('bodekasse').select('*').eq('id', bodekasseId).single(),
    supabase.from('bodekasse_saeson').select('pause').eq('bodekasse_id', bodekasseId).maybeSingle(),
  ]);
  if (kasse.error) throw kasse.error;
  if (saeson.error) throw saeson.error;
  return { indstillinger: kasse.data, pause: saeson.data?.pause ?? false };
}

/**
 * Admin only: changes the settings in `aendringer` and nothing else. Throws
 * the RPC error (show it with `rpcErrorText`). Pass the same `klientId` when
 * retrying the same change.
 */
export async function opdaterIndstillinger(
  klientId: string,
  bodekasseId: string,
  aendringer: IndstillingAendringer,
): Promise<void> {
  const { error } = await supabase.rpc('opdater_indstillinger', {
    p_klient_id: klientId,
    p_bodekasse: bodekasseId,
    p_aendringer: aendringer,
  });
  if (error) throw error;
}
