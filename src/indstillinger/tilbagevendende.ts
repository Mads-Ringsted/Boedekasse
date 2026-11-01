import { parsePris } from '../kategorier/kategoriListe.ts';
import { t } from '../strings/index.ts';
import type { Enums } from '../supabase/database.types.ts';

/** 'uge' (dag = ISO weekday, 1 = mandag) or 'maaned' (dag = 1-28). */
export type Frekvens = Enums<'tilbagevendende_frekvens'>;

/** A Tilbagevendende Gebyr as the settings screen shows it. */
export interface Regel {
  id: string;
  navn: string;
  beloeb: number;
  frekvens: Frekvens;
  dag: number;
  /** The Medlemmer it hits (Udmeldte may be among them; they are skipped). */
  medlemmer: string[];
}

const ugedag = new Intl.DateTimeFormat('da', { weekday: 'long', timeZone: 'UTC' });

/** "mandag" for 1 ... "søndag" for 7. */
export function ugedagNavn(dag: number): string {
  // 2024-01-01 was a Monday.
  return ugedag.format(new Date(Date.UTC(2024, 0, dag)));
}

/** "Hver mandag" or "Den 15. hver måned". */
export function frekvensTekst(frekvens: Frekvens, dag: number): string {
  return frekvens === 'uge'
    ? t('tilbagevendende.hverUge', { ugedag: ugedagNavn(dag) })
    : t('tilbagevendende.hverMaaned', { dag });
}

const dansk = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Copenhagen' });

/**
 * The date (YYYY-MM-DD) of the next charge after today, by the Copenhagen
 * calendar. Never today: today's occurrence was charged at midnight, and a
 * rule made or edited today counts from tomorrow (as the server does).
 */
export function naesteForekomst(frekvens: Frekvens, dag: number, nu: Date = new Date()): string {
  const [aar, maaned, dato] = dansk.format(nu).split('-').map(Number);
  const d = new Date(Date.UTC(aar, maaned - 1, dato + 1));
  for (let i = 0; i < 31; i++) {
    const passer = frekvens === 'uge' ? (d.getUTCDay() || 7) === dag : d.getUTCDate() === dag;
    if (passer) break;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return d.toISOString().slice(0, 10);
}

export interface RegelForm {
  navn: string;
  beloeb: string;
  frekvens: Frekvens;
  dag: number;
  medlemmer: readonly string[];
}

export type RegelTjek =
  | { ok: true; vaerdi: Omit<Regel, 'id'> }
  | { ok: false; fejl: 'navn' | 'beloeb' | 'dag' | 'medlemmer' };

/** The form as the RPCs take it, or the first thing wrong. Mirrors `private.tjek_tilbagevendende`. */
export function tjekRegel(form: RegelForm): RegelTjek {
  const navn = form.navn.trim();
  if (navn === '') return { ok: false, fejl: 'navn' };
  const beloeb = parsePris(form.beloeb);
  if (beloeb === null) return { ok: false, fejl: 'beloeb' };
  const maks = form.frekvens === 'uge' ? 7 : 28;
  if (!Number.isInteger(form.dag) || form.dag < 1 || form.dag > maks) return { ok: false, fejl: 'dag' };
  if (form.medlemmer.length === 0) return { ok: false, fejl: 'medlemmer' };
  return { ok: true, vaerdi: { navn, beloeb, frekvens: form.frekvens, dag: form.dag, medlemmer: [...form.medlemmer] } };
}
