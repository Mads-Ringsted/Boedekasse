import { kortDato } from '../kategorier/kategoriListe.ts';
import { t } from '../strings/index.ts';

/** One Sæson in the picker, as `public.saeson_status` gives it. */
export interface SaesonPunkt {
  id: string;
  navn: string;
  startet: string;
  /** When it ends or ended; null = no end set. */
  slutter: string | null;
  /** The box's latest Sæson (the running one, or the last before a Pause). */
  erSeneste: boolean;
}

/** "4. jan – 30. sep" for an ended Sæson (its last day), "Fra 4. jan · kører" while it runs. */
export function saesonPeriode(s: Pick<SaesonPunkt, 'startet' | 'slutter'>, nu: Date = new Date()): string {
  const start = kortDato(s.startet, nu);
  if (s.slutter === null || nu.getTime() < Date.parse(s.slutter)) return t('saeson.periodeKoerer', { start });
  const sidsteOejeblik = new Date(Date.parse(s.slutter) - 1).toISOString();
  return t('saeson.periode', { start, slut: kortDato(sidsteOejeblik, nu) });
}
