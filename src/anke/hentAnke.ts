import { tilBoede, type Boede } from '../aktivitet/haendelse.ts';
import { supabase } from '../supabase/index.ts';
import { ankeVindue, type AnkeRegler } from './anke.ts';

/** The box's Anke settings and its running Sæson. */
export async function hentAnkeRegler(bodekasseId: string): Promise<AnkeRegler> {
  const [kasse, saeson] = await Promise.all([
    supabase
      .from('bodekasse')
      .select('anke_til, anke_vindue_timer, anke_min, anke_max_gange')
      .eq('id', bodekasseId)
      .single(),
    supabase.from('bodekasse_saeson').select('aktiv_saeson_id').eq('bodekasse_id', bodekasseId).maybeSingle(),
  ]);
  if (kasse.error) throw kasse.error;
  if (saeson.error) throw saeson.error;
  return {
    til: kasse.data.anke_til,
    vindueTimer: kasse.data.anke_vindue_timer,
    min: kasse.data.anke_min,
    maxGange: Number(kasse.data.anke_max_gange),
    aktivSaesonId: saeson.data?.aktiv_saeson_id ?? null,
  };
}

/** "Kan ankes": the Bøder you can still appeal, the one closing first on top. */
export async function hentKanAnkes(
  bodekasseId: string,
  medlemId: string,
): Promise<{ regler: AnkeRegler; boeder: Boede[] }> {
  const regler = await hentAnkeRegler(bodekasseId);
  if (!regler.til || !regler.aktivSaesonId) return { regler, boeder: [] };
  const fra = new Date(Date.now() - regler.vindueTimer * 3_600_000).toISOString();
  const { data, error } = await supabase
    .from('aktivitet_bode')
    .select('*')
    .eq('bodekasse_id', bodekasseId)
    .eq('saeson_id', regler.aktivSaesonId)
    .eq('modtager_id', medlemId)
    .is('anke_id', null)
    .is('annulleret', null)
    .gt('givet', fra)
    .order('givet', { ascending: true });
  if (error) throw error;
  const boeder = data.map(tilBoede).filter((b) => ankeVindue(b, medlemId, regler) !== null);
  return { regler, boeder };
}

/** Mere → Anker: every Bøde with an open Anke, newest first. */
export async function hentAabneAnker(bodekasseId: string): Promise<Boede[]> {
  const { data, error } = await supabase
    .from('aktivitet_bode')
    .select('*')
    .eq('bodekasse_id', bodekasseId)
    .eq('anket', true)
    .order('givet', { ascending: false });
  if (error) throw error;
  return data.map(tilBoede);
}

/** How many open Anker the box has (the badge on Mere). */
export async function hentAntalAabneAnker(bodekasseId: string): Promise<number> {
  const { count, error } = await supabase
    .from('aktivitet_bode')
    .select('id', { count: 'exact', head: true })
    .eq('bodekasse_id', bodekasseId)
    .eq('anket', true);
  if (error) throw error;
  return count ?? 0;
}
