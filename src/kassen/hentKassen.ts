import { kortNavne } from '../giv/navne.ts';
import { supabase } from '../supabase/index.ts';
import { betalere, kassePoster, type Betaler, type KassePost } from './kassen.ts';

export interface KassenData {
  /** I bødekassen: Indbetalt − Hævet, all Sæsoner, in kr. */
  beloeb: number;
  indbetalt: number;
  haevet: number;
  /** Mangler: what every Medlem owes together (positive Saldi only). */
  mangler: number;
  poster: KassePost[];
}

/** Everything Kassen shows: the box figures and every Indbetaling and Hævning, newest first. */
export async function hentKassen(bodekasseId: string, erAdmin: boolean): Promise<KassenData> {
  const [kassen, indbetalinger, haevninger, medlemmer, saeson] = await Promise.all([
    supabase
      .from('kassen')
      .select('beloeb, indbetalt, haevet, ikke_betalt')
      .eq('bodekasse_id', bodekasseId)
      .maybeSingle(),
    supabase
      .from('indbetaling')
      .select(
        'id, saeson_id, medlem_id, beloeb, note, registreret_af, registreret, annulleret, annulleret_af, annulleret_note',
      )
      .eq('bodekasse_id', bodekasseId),
    supabase
      .from('haevning')
      .select('id, saeson_id, beloeb, formaal, registreret_af, registreret, annulleret, annulleret_af, annulleret_note')
      .eq('bodekasse_id', bodekasseId),
    supabase.from('medlem').select('id, navn').eq('bodekasse_id', bodekasseId),
    supabase.from('bodekasse_saeson').select('seneste_saeson_id').eq('bodekasse_id', bodekasseId).maybeSingle(),
  ]);
  if (kassen.error) throw kassen.error;
  if (indbetalinger.error) throw indbetalinger.error;
  if (haevninger.error) throw haevninger.error;
  if (medlemmer.error) throw medlemmer.error;
  if (saeson.error) throw saeson.error;
  return {
    beloeb: kassen.data?.beloeb ?? 0,
    indbetalt: kassen.data?.indbetalt ?? 0,
    haevet: kassen.data?.haevet ?? 0,
    mangler: kassen.data?.ikke_betalt ?? 0,
    poster: kassePoster(
      indbetalinger.data,
      {
        // First names, unless two share one.
        navne: new Map(kortNavne(medlemmer.data.map((m) => m.navn)).map((n, i) => [medlemmer.data[i]!.id, n])),
        senesteSaesonId: saeson.data?.seneste_saeson_id ?? null,
        erAdmin,
      },
      haevninger.data,
    ),
  };
}

/** Everyone an Admin can register an Indbetaling from (Udmeldte too), with their Saldo. */
export async function hentBetalere(bodekasseId: string): Promise<{ aktive: Betaler[]; udmeldte: Betaler[] }> {
  const [medlemmer, saldi] = await Promise.all([
    supabase.from('medlem').select('id, navn, udmeldt').eq('bodekasse_id', bodekasseId),
    supabase.from('medlem_saldo').select('medlem_id, saldo').eq('bodekasse_id', bodekasseId),
  ]);
  if (medlemmer.error) throw medlemmer.error;
  if (saldi.error) throw saldi.error;
  return betalere(
    medlemmer.data,
    saldi.data.flatMap((s) => (s.medlem_id === null ? [] : [{ medlem_id: s.medlem_id, saldo: s.saldo ?? 0 }])),
  );
}
