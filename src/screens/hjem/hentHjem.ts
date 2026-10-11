import { supabase } from '../../supabase/index.ts';
import type { BoxTal } from './komIGang.ts';

export interface HjemData extends BoxTal {
  /** What is in the box now (Kassen), in kr. */
  iBoedekassen: number;
  /** The join code; null for non-Admins (they can't read it). */
  kode: string | null;
}

const count = async (query: PromiseLike<{ count: number | null; error: unknown }>) => {
  const { count: n, error } = await query;
  if (error) throw error;
  return n ?? 0;
};

/** Everything Hjem shows for a new box. #53 adds the Topliste and money figures. */
export async function hentHjem(bodekasseId: string, erAdmin: boolean): Promise<HjemData> {
  const [kassen, antalMedlemmer, antalBodekategorier, antalBoeder, kode] = await Promise.all([
    supabase.from('kassen').select('beloeb').eq('bodekasse_id', bodekasseId).maybeSingle(),
    count(
      supabase
        .from('medlem')
        .select('id', { count: 'exact', head: true })
        .eq('bodekasse_id', bodekasseId)
        .is('udmeldt', null),
    ),
    count(
      supabase
        .from('bodekategori')
        .select('id', { count: 'exact', head: true })
        .eq('bodekasse_id', bodekasseId)
        .is('arkiveret', null),
    ),
    count(supabase.from('bode').select('id', { count: 'exact', head: true }).eq('bodekasse_id', bodekasseId)),
    erAdmin
      ? supabase.from('bodekasse_kode').select('kode').eq('bodekasse_id', bodekasseId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (kassen.error) throw kassen.error;
  if (kode.error) throw kode.error;
  return {
    iBoedekassen: kassen.data?.beloeb ?? 0,
    antalMedlemmer,
    antalBodekategorier,
    antalBoeder,
    kode: kode.data?.kode ?? null,
  };
}
