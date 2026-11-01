import { supabase } from '../supabase/index.ts';
import type { Regel } from './tilbagevendende.ts';

/** A Medlem a rule can hit. */
export interface RegelMedlem {
  id: string;
  navn: string;
  udmeldt: boolean;
}

export interface TilbagevendendeData {
  /** The rules still running (not stopped), oldest first. */
  regler: Regel[];
  /** Every Medlem of the box, by name. */
  medlemmer: RegelMedlem[];
}

const danskOrden = new Intl.Collator('da');

/** The box's running Tilbagevendende Gebyrer and its Medlemmer (any Medlem may read them). */
export async function hentTilbagevendende(bodekasseId: string): Promise<TilbagevendendeData> {
  const [regler, rm, medlemmer] = await Promise.all([
    supabase
      .from('tilbagevendende')
      .select('id, navn, beloeb, frekvens, dag')
      .eq('bodekasse_id', bodekasseId)
      .is('stoppet', null)
      .order('oprettet'),
    supabase.from('tilbagevendende_medlem').select('tilbagevendende_id, medlem_id').eq('bodekasse_id', bodekasseId),
    supabase.from('medlem').select('id, navn, udmeldt').eq('bodekasse_id', bodekasseId),
  ]);
  if (regler.error) throw regler.error;
  if (rm.error) throw rm.error;
  if (medlemmer.error) throw medlemmer.error;
  return {
    regler: regler.data.map((r) => ({
      ...r,
      medlemmer: rm.data.filter((x) => x.tilbagevendende_id === r.id).map((x) => x.medlem_id),
    })),
    medlemmer: medlemmer.data
      .map((m) => ({ id: m.id, navn: m.navn, udmeldt: m.udmeldt !== null }))
      .sort((a, b) => danskOrden.compare(a.navn, b.navn)),
  };
}

/**
 * Admin only: creates a rule (`regelId` null) or edits one. Throws the RPC
 * error (show it with `rpcErrorText`). One `klientId` per opening of the form.
 */
export async function gemTilbagevendende(
  klientId: string,
  bodekasseId: string,
  regelId: string | null,
  regel: Omit<Regel, 'id'>,
): Promise<void> {
  const felter = {
    p_klient_id: klientId,
    p_navn: regel.navn,
    p_beloeb: regel.beloeb,
    p_frekvens: regel.frekvens,
    p_dag: regel.dag,
    p_medlemmer: regel.medlemmer,
  };
  const { error } = regelId
    ? await supabase.rpc('ret_tilbagevendende', { ...felter, p_tilbagevendende: regelId })
    : await supabase.rpc('opret_tilbagevendende', { ...felter, p_bodekasse: bodekasseId });
  if (error) throw error;
}

/** Admin only: stops a rule. Throws the RPC error. */
export async function stopTilbagevendende(klientId: string, regelId: string): Promise<void> {
  const { error } = await supabase.rpc('stop_tilbagevendende', { p_klient_id: klientId, p_tilbagevendende: regelId });
  if (error) throw error;
}
