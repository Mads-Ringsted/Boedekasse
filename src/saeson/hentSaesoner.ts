import { hentSaesonTopliste } from '../screens/hjem/hentHjem.ts';
import type { ToplisteRad } from '../screens/hjem/topliste.ts';
import { supabase } from '../supabase/index.ts';
import type { SaesonPunkt } from './tidligere.ts';

/** Every Sæson of the box, newest first. */
export async function hentSaesoner(bodekasseId: string): Promise<SaesonPunkt[]> {
  const { data, error } = await supabase
    .from('saeson_status')
    .select('id, navn, startet, slutter, er_seneste')
    .eq('bodekasse_id', bodekasseId)
    .order('loebenr', { ascending: false });
  if (error) throw error;
  return data.map((s) => ({
    id: s.id ?? '',
    navn: s.navn ?? '',
    startet: s.startet ?? '',
    slutter: s.slutter,
    erSeneste: s.er_seneste === true,
  }));
}

/** What a past Sæson's page shows: its figures, Topliste and the list of Sæsoner. */
export interface TidligereSaesonData {
  saesoner: SaesonPunkt[];
  /** Null when the Sæson isn't in this box. */
  saeson: SaesonPunkt | null;
  /** Bøder i alt in the Sæson (every Medlem, Udmeldte too), in kr. */
  boederIAlt: number;
  /** Indbetalt in the Sæson, in kr. */
  indbetalt: number;
  topliste: ToplisteRad[];
}

export async function hentTidligereSaeson(bodekasseId: string, saesonId: string): Promise<TidligereSaesonData> {
  const [saesoner, tal, topliste] = await Promise.all([
    hentSaesoner(bodekasseId),
    supabase
      .from('medlem_saeson_tal')
      .select('boeder_i_alt, indbetalt')
      .eq('bodekasse_id', bodekasseId)
      .eq('saeson_id', saesonId),
    hentSaesonTopliste(saesonId),
  ]);
  if (tal.error) throw tal.error;
  const sum = (felt: 'boeder_i_alt' | 'indbetalt') => tal.data.reduce((n, r) => n + (r[felt] ?? 0), 0);
  return {
    saesoner,
    saeson: saesoner.find((s) => s.id === saesonId) ?? null,
    boederIAlt: sum('boeder_i_alt'),
    indbetalt: sum('indbetalt'),
    topliste,
  };
}
