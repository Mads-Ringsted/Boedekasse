import { supabase } from '../supabase/index.ts';
import { tilKonkurrence, type Konkurrence } from './konkurrence.ts';

/** What every Konkurrence screen needs to know about the box. */
export interface KonkurrenceRegler {
  /** Konkurrence is switched on (else the screens are hidden). */
  til: boolean;
  /** The placement table, kr per place (1st first). */
  placeringer: number[];
  fravaersgebyr: number;
  /** The running Sæson; null in a Pause (no new or corrected Konkurrencer). */
  aktivSaesonId: string | null;
  /** The latest Sæson (annulling works on it until the next starts). */
  senesteSaesonId: string | null;
}

/** An active Medlem who must be placed or absent. */
export interface Deltagbar {
  medlemId: string;
  navn: string;
  loggetInd: boolean;
}

export async function hentRegler(bodekasseId: string): Promise<KonkurrenceRegler> {
  const [kasse, saeson] = await Promise.all([
    supabase.from('bodekasse').select('konkurrence_til, placeringer, fravaersgebyr').eq('id', bodekasseId).single(),
    supabase
      .from('bodekasse_saeson')
      .select('aktiv_saeson_id, seneste_saeson_id')
      .eq('bodekasse_id', bodekasseId)
      .maybeSingle(),
  ]);
  if (kasse.error) throw kasse.error;
  if (saeson.error) throw saeson.error;
  return {
    til: kasse.data.konkurrence_til,
    placeringer: kasse.data.placeringer,
    fravaersgebyr: kasse.data.fravaersgebyr,
    aktivSaesonId: saeson.data?.aktiv_saeson_id ?? null,
    senesteSaesonId: saeson.data?.seneste_saeson_id ?? null,
  };
}

/** The latest Sæson's Konkurrencer, newest first, with the box's rules. */
export async function hentKonkurrencer(
  bodekasseId: string,
): Promise<{ regler: KonkurrenceRegler; konkurrencer: Konkurrence[] }> {
  const regler = await hentRegler(bodekasseId);
  if (!regler.senesteSaesonId) return { regler, konkurrencer: [] };
  const { data, error } = await supabase
    .from('konkurrence_visning')
    .select('*')
    .eq('bodekasse_id', bodekasseId)
    .eq('saeson_id', regler.senesteSaesonId)
    .order('dato', { ascending: false })
    .order('oprettet', { ascending: false });
  if (error) throw error;
  return { regler, konkurrencer: data.map(tilKonkurrence) };
}

/** One Konkurrence (null when it isn't there), with the box's rules. */
export async function hentKonkurrence(
  bodekasseId: string,
  konkurrenceId: string,
): Promise<{ regler: KonkurrenceRegler; konkurrence: Konkurrence | null }> {
  const [regler, svar] = await Promise.all([
    hentRegler(bodekasseId),
    supabase.from('konkurrence_visning').select('*').eq('id', konkurrenceId).maybeSingle(),
  ]);
  if (svar.error) throw svar.error;
  return { regler, konkurrence: svar.data ? tilKonkurrence(svar.data) : null };
}

/** Every active Medlem (claimed or not, not Udmeldt). */
export async function hentDeltagbare(bodekasseId: string): Promise<Deltagbar[]> {
  const { data, error } = await supabase
    .from('medlem')
    .select('id, navn, user_id')
    .eq('bodekasse_id', bodekasseId)
    .is('udmeldt', null);
  if (error) throw error;
  return data.map((m) => ({ medlemId: m.id, navn: m.navn, loggetInd: m.user_id !== null }));
}

/** Records a Konkurrence; throws the RPC error. Returns its id. */
export async function registrerKonkurrence(opts: {
  klientId: string;
  bodekasseId: string;
  titel: string;
  dato: string;
  grupper: string[][];
}): Promise<string> {
  const { data, error } = await supabase.rpc('registrer_konkurrence', {
    p_klient_id: opts.klientId,
    p_bodekasse: opts.bodekasseId,
    p_titel: opts.titel,
    p_dato: opts.dato,
    p_placeringer: opts.grupper,
  });
  if (error) throw error;
  return (data as { konkurrence_id: string }).konkurrence_id;
}

/** Corrects a Konkurrence (recorder or Admin, running Sæson); throws the RPC error. */
export async function retKonkurrence(opts: {
  klientId: string;
  konkurrenceId: string;
  titel: string;
  dato: string;
  grupper: string[][];
}): Promise<void> {
  const { error } = await supabase.rpc('ret_konkurrence', {
    p_klient_id: opts.klientId,
    p_konkurrence: opts.konkurrenceId,
    p_titel: opts.titel,
    p_dato: opts.dato,
    p_placeringer: opts.grupper,
  });
  if (error) throw error;
}

/** Annuls a Konkurrence and all its Gebyrer; throws the RPC error. */
export async function annullerKonkurrence(klientId: string, konkurrenceId: string, note: string): Promise<void> {
  const { error } = await supabase.rpc('annuller_konkurrence', {
    p_klient_id: klientId,
    p_konkurrence: konkurrenceId,
    p_note: note,
  });
  if (error) throw error;
}
