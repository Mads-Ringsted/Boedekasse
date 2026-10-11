import { supabase } from '../supabase/index.ts';
import { medlemsliste, tidligereMedlemmer, type Medlemslinje, type TidligereLinje } from './medlemsliste.ts';

export interface MedlemmerData {
  linjer: Medlemslinje[];
  /** Udmeldte, for Tidligere medlemmer. */
  tidligere: TidligereLinje[];
  /** The join code; null for non-Admins (they can't read it). */
  kode: string | null;
}

/** Everything Medlemmer shows: every Medlem with what they owe (active and Udmeldte), and the code for Admins. */
export async function hentMedlemmer(bodekasseId: string, medlemId: string, erAdmin: boolean): Promise<MedlemmerData> {
  const [medlemmer, saldi, kode] = await Promise.all([
    supabase.from('medlem').select('id, navn, er_admin, user_id, udmeldt').eq('bodekasse_id', bodekasseId),
    supabase.from('medlem_saldo').select('medlem_id, saldo').eq('bodekasse_id', bodekasseId),
    erAdmin ? hentJoinKode(bodekasseId) : Promise.resolve(null),
  ]);
  if (medlemmer.error) throw medlemmer.error;
  if (saldi.error) throw saldi.error;
  const saldoRaekker = saldi.data.flatMap((s) =>
    s.medlem_id === null ? [] : [{ medlem_id: s.medlem_id, saldo: s.saldo ?? 0 }],
  );
  return {
    linjer: medlemsliste(medlemmer.data, saldoRaekker, medlemId),
    tidligere: tidligereMedlemmer(medlemmer.data, saldoRaekker),
    kode,
  };
}

/** The box's join code. Only Admins can read it (RLS); others get null. */
export async function hentJoinKode(bodekasseId: string): Promise<string | null> {
  const { data, error } = await supabase.from('bodekasse_kode').select('kode').eq('bodekasse_id', bodekasseId).maybeSingle();
  if (error) throw error;
  return data?.kode ?? null;
}
