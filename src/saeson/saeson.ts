import { kortDato } from '../kategorier/kategoriListe.ts';
import { t } from '../strings/index.ts';

/** The latest Sæson of a box, as `public.saeson_status` gives it. */
export interface Saeson {
  id: string;
  navn: string;
  /** The planned last day, `YYYY-MM-DD`, or null. */
  slutdato: string | null;
  /** When it ends (Copenhagen midnight after slutdato, or when it was ended); null = no end. */
  slutter: string | null;
}

const dagNoegle = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Copenhagen',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Today's date in Copenhagen, `YYYY-MM-DD`. */
export function iDagIKoebenhavn(nu: Date = new Date()): string {
  return dagNoegle.format(nu);
}

/** Whether the latest Sæson runs now. No Sæson, or one past its end, is a Pause. */
export function koerer(saeson: Saeson | null, nu: Date = new Date()): boolean {
  if (!saeson) return false;
  return saeson.slutter === null || nu.getTime() < Date.parse(saeson.slutter);
}

/** Milliseconds until the running Sæson ends; null when it has no end or has ended. */
export function msTilSlut(saeson: Saeson | null, nu: Date = new Date()): number | null {
  if (!saeson?.slutter) return null;
  const ms = Date.parse(saeson.slutter) - nu.getTime();
  return ms > 0 ? ms : null;
}

/** The Pause card's line: "Sæson 2026 sluttede 30. sep" (its last day). */
export function pauseLinje(saeson: Saeson, nu: Date = new Date()): string {
  const slut = saeson.slutter ? Date.parse(saeson.slutter) : nu.getTime();
  const sidsteOejeblik = new Date(slut - 1).toISOString();
  return t('saeson.sluttede', { saeson: saeson.navn, dato: kortDato(sidsteOejeblik, nu) });
}

/** The end date row's value: "20. dec", or "Ingen dato". */
export function slutdatoTekst(slutdato: string | null, nu: Date = new Date()): string {
  return slutdato ? kortDato(`${slutdato}T12:00:00Z`, nu) : t('saeson.ingenSlutdato');
}

/** Checks a picked end date (`YYYY-MM-DD`): today or later, Copenhagen time. */
export function tjekSlutdato(
  tekst: string,
  nu: Date = new Date(),
): { ok: true; vaerdi: string } | { ok: false; fejl: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tekst) || tekst < iDagIKoebenhavn(nu)) {
    return { ok: false, fejl: t('saeson.slutdatoFortid') };
  }
  return { ok: true, vaerdi: tekst };
}
