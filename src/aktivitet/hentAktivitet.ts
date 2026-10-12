import { supabase } from '../supabase/index.ts';
import { tilBoede, tilHaendelse, type Boede, type Haendelse } from './haendelse.ts';

/** Entries per page. */
export const SIDE = 30;

/** The box's latest Sæson (the running one, or the last before a Pause). */
export async function hentSenesteSaeson(bodekasseId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('bodekasse_saeson')
    .select('seneste_saeson_id')
    .eq('bodekasse_id', bodekasseId)
    .maybeSingle();
  if (error) throw error;
  return data?.seneste_saeson_id ?? null;
}

/**
 * One page of a Sæson's feed, newest first. `foerId` continues after the
 * last entry of the previous page. With `medlemId`, only the entries where
 * that Medlem gave, received or was charged.
 */
export async function hentAktivitetSide(opts: {
  bodekasseId: string;
  saesonId: string;
  medlemId?: string;
  foerId?: number;
}): Promise<{ haendelser: Haendelse[]; flere: boolean }> {
  let q = supabase
    .from('aktivitet')
    .select('*')
    .eq('bodekasse_id', opts.bodekasseId)
    .eq('saeson_id', opts.saesonId);
  if (opts.medlemId) q = q.contains('involverede', [opts.medlemId]);
  if (opts.foerId !== undefined) q = q.lt('id', opts.foerId);
  const { data, error } = await q.order('id', { ascending: false }).limit(SIDE + 1);
  if (error) throw error;
  return { haendelser: data.slice(0, SIDE).map(tilHaendelse), flere: data.length > SIDE };
}

/** One Bøde with its live state, or null when it no longer exists (Fortryd). */
export async function hentBoede(boedeId: string): Promise<Boede | null> {
  const { data, error } = await supabase.from('aktivitet_bode').select('*').eq('id', boedeId).maybeSingle();
  if (error) throw error;
  return data ? tilBoede(data) : null;
}
