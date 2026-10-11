import { supabase } from '../../supabase/index.ts';
import type { BoxTal } from './komIGang.ts';
import type { ToplisteRad } from './topliste.ts';

export interface HjemData extends BoxTal {
  /** What is in the box now (Kassen), in kr. */
  iBoedekassen: number;
  /** Indbetalt, all Sæsoner, in kr. */
  indbetalt: number;
  /** "I alt ikke betalte bøder": what every Medlem owes, in kr. */
  ikkeBetalt: number;
  /** Your Saldo; negative = Til gode. */
  minSaldo: number;
  /** The latest Sæson's Topliste (the ended one in a Pause). */
  topliste: ToplisteRad[];
  /** The join code; null for non-Admins (they can't read it). */
  kode: string | null;
}

const count = async (query: PromiseLike<{ count: number | null; error: unknown }>) => {
  const { count: n, error } = await query;
  if (error) throw error;
  return n ?? 0;
};

async function hentTopliste(bodekasseId: string): Promise<ToplisteRad[]> {
  const saeson = await supabase
    .from('bodekasse_saeson')
    .select('seneste_saeson_id')
    .eq('bodekasse_id', bodekasseId)
    .maybeSingle();
  if (saeson.error) throw saeson.error;
  const saesonId = saeson.data?.seneste_saeson_id;
  if (!saesonId) return [];
  const { data, error } = await supabase
    .from('topliste')
    .select('medlem_id, navn, boeder_i_alt, indbetalt, plads')
    .eq('saeson_id', saesonId);
  if (error) throw error;
  return data.map((r) => ({
    medlemId: r.medlem_id ?? '',
    navn: r.navn ?? '',
    boederIAlt: r.boeder_i_alt ?? 0,
    indbetalt: r.indbetalt ?? 0,
    plads: r.plads ?? 0,
  }));
}

/** Everything Hjem shows: box figures, your Saldo, the Topliste and Kom i gang counts. */
export async function hentHjem(bodekasseId: string, medlemId: string, erAdmin: boolean): Promise<HjemData> {
  const [kassen, saldo, topliste, antalMedlemmer, antalBodekategorier, antalBoeder, kode] = await Promise.all([
    supabase.from('kassen').select('beloeb, indbetalt, ikke_betalt').eq('bodekasse_id', bodekasseId).maybeSingle(),
    supabase.from('medlem_saldo').select('saldo').eq('medlem_id', medlemId).maybeSingle(),
    hentTopliste(bodekasseId),
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
  if (saldo.error) throw saldo.error;
  if (kode.error) throw kode.error;
  return {
    iBoedekassen: kassen.data?.beloeb ?? 0,
    indbetalt: kassen.data?.indbetalt ?? 0,
    ikkeBetalt: kassen.data?.ikke_betalt ?? 0,
    minSaldo: saldo.data?.saldo ?? 0,
    topliste,
    antalMedlemmer,
    antalBodekategorier,
    antalBoeder,
    kode: kode.data?.kode ?? null,
  };
}
