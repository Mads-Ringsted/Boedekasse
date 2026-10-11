import { kortDato } from '../kategorier/kategoriListe.ts';
import { t } from '../strings/index.ts';

const MINUT = 60_000;
const TIME = 60 * MINUT;
const DAG = 24 * TIME;

const dagNoegle = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Copenhagen',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const ugedag = new Intl.DateTimeFormat('da', { timeZone: 'Europe/Copenhagen', weekday: 'long' });
const klokken = new Intl.DateTimeFormat('da', {
  timeZone: 'Europe/Copenhagen',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** Whole Copenhagen calendar days from `dato` to `nu` (0 = same day). */
function dageSiden(dato: Date, nu: Date): number {
  const dag = (d: Date) => Date.parse(`${dagNoegle.format(d)}T00:00:00Z`);
  return Math.round((dag(nu) - dag(dato)) / DAG);
}

const stort = (s: string) => s.charAt(0).toLocaleUpperCase('da') + s.slice(1);

/** How long ago, short: "Lige nu", "35 min", "5 t", then a date ("9. okt"). */
export function siden(iso: string, nu: Date = new Date()): string {
  const ms = nu.getTime() - new Date(iso).getTime();
  if (ms < MINUT) return t('tid.ligeNu');
  if (ms < TIME) return t('tid.minutter', { antal: Math.floor(ms / MINUT) });
  if (ms < DAG) return t('tid.timer', { antal: Math.floor(ms / TIME) });
  return kortDato(iso, nu);
}

/** The feed's day heading: "I dag", "I går", a weekday this week, else "1. okt". */
export function dagOverskrift(iso: string, nu: Date = new Date()): string {
  const dato = new Date(iso);
  const dage = dageSiden(dato, nu);
  if (dage <= 0) return t('tid.iDag');
  if (dage === 1) return t('tid.iGaar');
  if (dage < 7) return stort(ugedag.format(dato));
  return kortDato(iso, nu);
}

/** True when the time falls on today's Copenhagen date. */
export function iDag(iso: string, nu: Date = new Date()): boolean {
  return dageSiden(new Date(iso), nu) <= 0;
}

/** Entries (already newest first) grouped under one heading per Copenhagen day. */
export function iDage<P extends { tid: string }>(
  poster: readonly P[],
  nu: Date = new Date(),
): { noegle: string; overskrift: string; poster: P[] }[] {
  const dage: { noegle: string; overskrift: string; poster: P[] }[] = [];
  for (const p of poster) {
    const noegle = dagNoegle.format(new Date(p.tid));
    const sidste = dage[dage.length - 1];
    if (sidste?.noegle === noegle) sidste.poster.push(p);
    else dage.push({ noegle, overskrift: dagOverskrift(p.tid, nu), poster: [p] });
  }
  return dage;
}

/** "I dag kl. 18.42", "I går kl. 09.05", "12. aug kl. 18.42". */
export function givetTekst(iso: string, nu: Date = new Date()): string {
  const dato = new Date(iso);
  const dage = dageSiden(dato, nu);
  const dag = dage <= 0 ? t('tid.iDag') : dage === 1 ? t('tid.iGaar') : kortDato(iso, nu);
  return t('tid.dagKl', { dag, kl: klokken.format(dato).replace(':', '.') });
}
