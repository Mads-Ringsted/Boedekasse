import { supabase } from '../supabase/index.ts';
import type { TilbagevendendeGebyr } from './tilbagevendende.ts';

/** A Medlem a Tilbagevendende Gebyr can hit. */
export interface TilbagevendendeMedlem {
  id: string;
  navn: string;
  udmeldt: boolean;
}

export interface TilbagevendendeData {
  /** The Tilbagevendende Gebyrer still running (not stopped), oldest first. */
  tilbagevendende: TilbagevendendeGebyr[];
  /** Every Medlem of the box, by name. */
  medlemmer: TilbagevendendeMedlem[];
}

const danskOrden = new Intl.Collator('da');

/** The box's running Tilbagevendende Gebyrer and its Medlemmer (any Medlem may read them). */
export async function hentTilbagevendende(bodekasseId: string): Promise<TilbagevendendeData> {
  const [tilbagevendende, rm, medlemmer] = await Promise.all([
    supabase
      .from('tilbagevendende')
      .select('id, navn, beloeb, frekvens, dag')
      .eq('bodekasse_id', bodekasseId)
      .is('stoppet', null)
      .order('oprettet'),
    supabase.from('tilbagevendende_medlem').select('tilbagevendende_id, medlem_id').eq('bodekasse_id', bodekasseId),
    supabase.from('medlem').select('id, navn, udmeldt').eq('bodekasse_id', bodekasseId),
  ]);
  if (tilbagevendende.error) throw tilbagevendende.error;
  if (rm.error) throw rm.error;
  if (medlemmer.error) throw medlemmer.error;
  return {
    tilbagevendende: tilbagevendende.data.map((r) => ({
      ...r,
      medlemmer: rm.data.filter((x) => x.tilbagevendende_id === r.id).map((x) => x.medlem_id),
    })),
    medlemmer: medlemmer.data
      .map((m) => ({ id: m.id, navn: m.navn, udmeldt: m.udmeldt !== null }))
      .sort((a, b) => danskOrden.compare(a.navn, b.navn)),
  };
}

/**
 * Admin only: creates a Tilbagevendende Gebyr (`tilbagevendendeId` null) or
 * edits one. Throws the RPC error (show it with `rpcErrorText`). One
 * `klientId` per opening of the form.
 */
export async function gemTilbagevendende(
  klientId: string,
  bodekasseId: string,
  tilbagevendendeId: string | null,
  tilbagevendende: Omit<TilbagevendendeGebyr, 'id'>,
): Promise<void> {
  const felter = {
    p_klient_id: klientId,
    p_navn: tilbagevendende.navn,
    p_beloeb: tilbagevendende.beloeb,
    p_frekvens: tilbagevendende.frekvens,
    p_dag: tilbagevendende.dag,
    p_medlemmer: tilbagevendende.medlemmer,
  };
  const { error } = tilbagevendendeId
    ? await supabase.rpc('ret_tilbagevendende', { ...felter, p_tilbagevendende: tilbagevendendeId })
    : await supabase.rpc('opret_tilbagevendende', { ...felter, p_bodekasse: bodekasseId });
  if (error) throw error;
}

/** Admin only: stops a Tilbagevendende Gebyr. Throws the RPC error. */
export async function stopTilbagevendende(klientId: string, tilbagevendendeId: string): Promise<void> {
  const { error } = await supabase.rpc('stop_tilbagevendende', {
    p_klient_id: klientId,
    p_tilbagevendende: tilbagevendendeId,
  });
  if (error) throw error;
}
