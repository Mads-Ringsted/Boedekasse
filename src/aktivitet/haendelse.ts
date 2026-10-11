import type { Database, Json } from '../supabase/database.types.ts';

type AktivitetRow = Database['public']['Views']['aktivitet']['Row'];
type BoedeRow = Database['public']['Views']['aktivitet_bode']['Row'];
export type Afgoerelse = Database['public']['Enums']['anke_afgoerelse'];

/** Who annulled something, when, and their note. */
export interface Annullering {
  tid: string;
  afId: string | null;
  afNavn: string;
  note: string | null;
}

/** One Bøde as the feed and the Bøde detail sheet show it (view `aktivitet_bode`). */
export interface Boede {
  id: string;
  batchId: string;
  giverId: string;
  giverNavn: string;
  modtagerId: string;
  modtagerNavn: string;
  bodekategoriId: string | null;
  /** The Bødekategori's name, or an Engangsbøde's reason. */
  navn: string;
  engangsbode: boolean;
  /** The kept price. */
  pris: number;
  givet: string;
  ankeId: string | null;
  afgoerelse: Afgoerelse | null;
  /** Has an Anke with no verdict yet (counts for nobody). */
  anket: boolean;
  afgoerelseAendret: boolean;
  /** Who bears it now; null when anket or annulled. */
  baererId: string | null;
  annullering: Annullering | null;
  /** The Engangsbøde Gebyr the giver pays (0 for the rest). */
  gebyr: number;
}

/** One Gebyr on a feed entry's cause. */
export interface Gebyr {
  id: string;
  art: string;
  beloeb: number;
  medlemId: string;
  medlemNavn: string;
  annullering: Annullering | null;
}

/** One feed entry (view `aktivitet`), with the live state of what it is about. */
export interface Haendelse {
  id: number;
  tid: string;
  /** The entry kind, e.g. 'boeder_givet'. See `arter/index.ts`. */
  art: string;
  aktoerId: string | null;
  aktoerNavn: string | null;
  modtagerId: string | null;
  modtagerNavn: string | null;
  batchId: string | null;
  refTabel: string | null;
  refId: string | null;
  /** The snapshot the RPC stored (names, amounts); shape depends on `art`. */
  data: Record<string, Json | undefined>;
  /** Set when the row the entry is about (ref) was annulled. */
  annullering: Annullering | null;
  /** A Giv batch entry: this receiver's Bøder in the batch. Else empty. */
  boeder: Boede[];
  /** The Gebyrer the entry's cause charged, annulled ones too. */
  gebyrer: Gebyr[];
}

type Obj = Record<string, unknown>;
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const strEllerNull = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const tal = (v: unknown): number => (typeof v === 'number' ? v : 0);

function annullering(r: Obj): Annullering | null {
  const tid = strEllerNull(r.annulleret);
  if (!tid) return null;
  return {
    tid,
    afId: strEllerNull(r.annulleret_af),
    afNavn: str(r.annulleret_af_navn),
    note: strEllerNull(r.annulleret_note),
  };
}

/** A row of `aktivitet_bode` (or one element of `aktivitet.boeder`). */
export function tilBoede(raw: BoedeRow | Obj): Boede {
  const r = raw as Obj;
  return {
    id: str(r.id),
    batchId: str(r.batch_id),
    giverId: str(r.giver_id),
    giverNavn: str(r.giver_navn),
    modtagerId: str(r.modtager_id),
    modtagerNavn: str(r.modtager_navn),
    bodekategoriId: strEllerNull(r.bodekategori_id),
    navn: str(r.navn),
    engangsbode: r.engangsbode === true,
    pris: tal(r.pris),
    givet: str(r.givet),
    ankeId: strEllerNull(r.anke_id),
    afgoerelse: strEllerNull(r.afgoerelse) as Afgoerelse | null,
    anket: r.anket === true,
    afgoerelseAendret: r.afgoerelse_aendret === true,
    baererId: strEllerNull(r.baerer_id),
    annullering: annullering(r),
    gebyr: tal(r.gebyr),
  };
}

const liste = (v: unknown): Obj[] => (Array.isArray(v) ? (v as Obj[]) : []);

/** A row of `aktivitet`. */
export function tilHaendelse(r: AktivitetRow): Haendelse {
  return {
    id: r.id ?? 0,
    tid: r.tid ?? '',
    art: r.art ?? '',
    aktoerId: r.aktoer_id,
    aktoerNavn: r.aktoer_navn,
    modtagerId: r.modtager_id,
    modtagerNavn: r.modtager_navn,
    batchId: r.batch_id,
    refTabel: r.ref_tabel,
    refId: r.ref_id,
    data: r.data && typeof r.data === 'object' && !Array.isArray(r.data) ? r.data : {},
    annullering: annullering(r as Obj),
    boeder: liste(r.boeder).map(tilBoede),
    gebyrer: liste(r.gebyrer).map((g) => ({
      id: str(g.id),
      art: str(g.art),
      beloeb: tal(g.beloeb),
      medlemId: str(g.medlem_id),
      medlemNavn: str(g.medlem_navn),
      annullering: annullering(g),
    })),
  };
}
