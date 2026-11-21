/**
 * Udseende: light, dark, or follow the phone. The choice is per device, in
 * localStorage. A forced theme sets data-theme on <html>, which
 * docs/design/tokens.css reads. The inline script in index.html does the
 * same before first paint; udseende.test.ts keeps the two in step.
 */

export type Udseende = 'auto' | 'lys' | 'moerk';

export const UDSEENDER: readonly Udseende[] = ['auto', 'lys', 'moerk'];

export const UDSEENDE_NOEGLE = 'boedekasse.udseende';

/** The page background (--color-bg) per theme, for the theme-color meta tags. */
export const BAGGRUND = { light: '#F2F3F8', dark: '#0A0C12' } as const;

type Lager = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function erUdseende(vaerdi: unknown): vaerdi is Udseende {
  return UDSEENDER.includes(vaerdi as Udseende);
}

/** The saved choice; anything unknown or unreadable means Automatisk. */
export function laesUdseende(lager: Lager): Udseende {
  try {
    const vaerdi = lager.getItem(UDSEENDE_NOEGLE);
    return erUdseende(vaerdi) ? vaerdi : 'auto';
  } catch {
    return 'auto';
  }
}

/** Automatisk is stored as no value, so the default needs no entry. */
export function gemUdseende(lager: Lager, valg: Udseende): void {
  try {
    if (valg === 'auto') lager.removeItem(UDSEENDE_NOEGLE);
    else lager.setItem(UDSEENDE_NOEGLE, valg);
  } catch {
    // Private mode and the like: the choice lasts until the app closes.
  }
}

/** The data-theme value for <html>; null leaves the phone in charge. */
export function temaAttribut(valg: Udseende): 'light' | 'dark' | null {
  if (valg === 'lys') return 'light';
  if (valg === 'moerk') return 'dark';
  return null;
}

/**
 * What the two theme-color meta tags (one per prefers-color-scheme) should
 * say. A forced theme gives both the same colour, whatever the phone says.
 */
export function themeColors(valg: Udseende): { light: string; dark: string } {
  const tema = temaAttribut(valg);
  return tema ? { light: BAGGRUND[tema], dark: BAGGRUND[tema] } : { ...BAGGRUND };
}

/** Puts the choice on the page: data-theme and the theme-color tags. */
export function anvendUdseende(valg: Udseende, doc: Document = document): void {
  const tema = temaAttribut(valg);
  if (tema) doc.documentElement.dataset.theme = tema;
  else delete doc.documentElement.dataset.theme;
  const farver = themeColors(valg);
  for (const meta of doc.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    meta.content = meta.media.includes('dark') ? farver.dark : farver.light;
  }
}
