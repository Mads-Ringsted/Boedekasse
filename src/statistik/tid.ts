/** Copenhagen calendar helpers for the Statistik tab. */

const dele = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Copenhagen',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  hourCycle: 'h23',
  weekday: 'short',
});

const UGEDAGE = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const DAG_MS = 24 * 60 * 60 * 1000;

export interface Lokal {
  /** `YYYY-MM-DD` in Copenhagen. */
  dato: string;
  /** 0–23. */
  time: number;
  /** 0 = Monday … 6 = Sunday. */
  ugedag: number;
}

const cache = new Map<number, Lokal>();

/** The Copenhagen date, hour and weekday of a moment. */
export function lokal(tid: string | number): Lokal {
  const ms = typeof tid === 'number' ? tid : Date.parse(tid);
  const gemt = cache.get(ms);
  if (gemt) return gemt;
  const d: Record<string, string> = {};
  for (const p of dele.formatToParts(new Date(ms))) d[p.type] = p.value;
  const svar = { dato: `${d.year}-${d.month}-${d.day}`, time: Number(d.hour) % 24, ugedag: UGEDAGE.indexOf(d.weekday) };
  if (cache.size > 5000) cache.clear();
  cache.set(ms, svar);
  return svar;
}

/**
 * The evening a moment belongs to, as the Copenhagen date it started on: a day
 * runs 06:00 to 06:00 (as for Dos-bonus), so 01:30 counts as the night before.
 */
export function aften(tid: string): string {
  return lokal(Date.parse(tid) - 6 * 60 * 60 * 1000).dato;
}

/** The Monday (`YYYY-MM-DD`) of the ISO week a Copenhagen date falls in. */
export function mandag(dato: string): string {
  const d = new Date(`${dato}T12:00:00Z`);
  const ugedag = (d.getUTCDay() + 6) % 7;
  return new Date(d.getTime() - ugedag * DAG_MS).toISOString().slice(0, 10);
}

/** The ISO week number of a Copenhagen date. */
export function ugeNr(dato: string): number {
  const d = new Date(`${dato}T12:00:00Z`);
  const torsdag = new Date(d.getTime() + (3 - ((d.getUTCDay() + 6) % 7)) * DAG_MS);
  const aarStart = Date.UTC(torsdag.getUTCFullYear(), 0, 1);
  return 1 + Math.floor((torsdag.getTime() - aarStart) / (7 * DAG_MS));
}

/** The date a week later. */
export function plusDage(dato: string, dage: number): string {
  return new Date(Date.parse(`${dato}T12:00:00Z`) + dage * DAG_MS).toISOString().slice(0, 10);
}
