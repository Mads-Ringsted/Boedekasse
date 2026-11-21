import { supabase } from '../supabase/index.ts';
import type { Beloeb, StatBoede, StatMedlem } from './statistik.ts';

export interface StatKategori {
  id: string;
  navn: string;
  arkiveret: boolean;
}

export interface StatSaeson {
  id: string;
  navn: string;
  startet: string;
  /** When it ended or will end; null = no end. */
  slutter: string | null;
  erSeneste: boolean;
}

/** One Sæson's records, as the Statistik tab needs them. */
export interface StatData {
  saesoner: StatSaeson[];
  /** The Sæson shown; null when the box has none. */
  saeson: StatSaeson | null;
  medlemmer: StatMedlem[];
  kategorier: StatKategori[];
  /** Not annulled. */
  boeder: StatBoede[];
  /** Bøder borne and Gebyrer, not annulled: what Medlemmer owe. */
  charges: Beloeb[];
  /** Not annulled. */
  indbetalinger: Beloeb[];
}

const SIDE = 1000;

/** Reads every row of a query, a page at a time (PostgREST caps each answer). */
async function alle<T>(side: (fra: number, til: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const ud: T[] = [];
  for (let fra = 0; ; fra += SIDE) {
    const { data, error } = await side(fra, fra + SIDE - 1);
    if (error) throw error;
    ud.push(...(data ?? []));
    if (!data || data.length < SIDE) return ud;
  }
}

/** The box's Sæsoner (newest first) and, for one of them (default: latest), its records. */
export async function hentStatistik(bodekasseId: string, saesonId: string | null): Promise<StatData> {
  const [saesonSvar, medlemSvar, kategoriSvar] = await Promise.all([
    supabase
      .from('saeson_status')
      .select('id, navn, startet, slutter, er_seneste')
      .eq('bodekasse_id', bodekasseId)
      .order('loebenr', { ascending: false }),
    supabase.from('medlem').select('id, navn, udmeldt').eq('bodekasse_id', bodekasseId),
    supabase.from('bodekategori').select('id, navn, arkiveret').eq('bodekasse_id', bodekasseId),
  ]);
  if (saesonSvar.error) throw saesonSvar.error;
  if (medlemSvar.error) throw medlemSvar.error;
  if (kategoriSvar.error) throw kategoriSvar.error;

  const saesoner: StatSaeson[] = saesonSvar.data.map((s) => ({
    id: s.id ?? '',
    navn: s.navn ?? '',
    startet: s.startet ?? '',
    slutter: s.slutter,
    erSeneste: s.er_seneste === true,
  }));
  const saeson = saesoner.find((s) => s.id === saesonId) ?? saesoner[0] ?? null;
  const medlemmer = medlemSvar.data.map((m) => ({ id: m.id, navn: m.navn, udmeldt: m.udmeldt !== null }));
  const kategorier = kategoriSvar.data.map((k) => ({ id: k.id, navn: k.navn, arkiveret: k.arkiveret !== null }));
  if (!saeson) return { saesoner, saeson, medlemmer, kategorier, boeder: [], charges: [], indbetalinger: [] };

  const [boedeRaekker, gebyrRaekker, indbetalingRaekker] = await Promise.all([
    alle((fra, til) =>
      supabase
        .from('bode_baerer')
        .select('id, giver_id, modtager_id, baerer_id, bodekategori_id, pris, givet, anket, afgoerelse')
        .eq('saeson_id', saeson.id)
        .is('annulleret', null)
        .order('givet')
        .order('id')
        .range(fra, til),
    ),
    alle((fra, til) =>
      supabase
        .from('gebyr')
        .select('id, medlem_id, beloeb, oprettet')
        .eq('saeson_id', saeson.id)
        .is('annulleret', null)
        .order('oprettet')
        .order('id')
        .range(fra, til),
    ),
    alle((fra, til) =>
      supabase
        .from('indbetaling')
        .select('id, medlem_id, beloeb, registreret')
        .eq('saeson_id', saeson.id)
        .is('annulleret', null)
        .order('registreret')
        .order('id')
        .range(fra, til),
    ),
  ]);

  const boeder: StatBoede[] = boedeRaekker.map((b) => ({
    id: b.id ?? '',
    giverId: b.giver_id ?? '',
    modtagerId: b.modtager_id ?? '',
    baererId: b.baerer_id ?? b.modtager_id ?? '',
    kategoriId: b.bodekategori_id,
    pris: b.pris ?? 0,
    givet: b.givet ?? '',
    anket: b.anket === true,
    afgoerelse: b.afgoerelse,
  }));
  const charges: Beloeb[] = [
    ...boeder.map((b) => ({ medlemId: b.baererId, beloeb: b.pris, tid: b.givet })),
    ...gebyrRaekker.map((g) => ({ medlemId: g.medlem_id, beloeb: g.beloeb, tid: g.oprettet })),
  ];
  const indbetalinger: Beloeb[] = indbetalingRaekker.map((i) => ({
    medlemId: i.medlem_id,
    beloeb: i.beloeb,
    tid: i.registreret,
  }));
  return { saesoner, saeson, medlemmer, kategorier, boeder, charges, indbetalinger };
}
