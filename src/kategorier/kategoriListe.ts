/** What the list needs to know about one Bødekategori. */
export interface ListeKategori {
  id: string;
  navn: string;
  pris: number;
  /** Bøder given with it this Sæson (not annulled). */
  antal: number;
  /** Among the box's five most used this Sæson. */
  ofteBrugt: boolean;
  arkiveret: boolean;
}

export type Sortering = 'navn' | 'pris';

const dansk = new Intl.Collator('da', { sensitivity: 'base', numeric: true });
const efterNavn = (a: ListeKategori, b: ListeKategori) => dansk.compare(a.navn, b.navn);

/**
 * The Bødekategorier screen's list: the active ones in the chosen order and
 * the archived ones apart (A–Å), both filtered by the search.
 * By Navn, the "Ofte brugt" ones come first (most used first), then A–Å.
 * By Pris, cheapest first.
 */
export function kategoriListe<K extends ListeKategori>(
  kategorier: readonly K[],
  { soeg, sortering }: { soeg: string; sortering: Sortering },
): { aktive: K[]; arkiverede: K[] } {
  const ord = soeg.trim().toLocaleLowerCase('da');
  const fundne = ord ? kategorier.filter((k) => k.navn.toLocaleLowerCase('da').includes(ord)) : [...kategorier];

  const aktive = fundne.filter((k) => !k.arkiveret);
  if (sortering === 'pris') {
    aktive.sort((a, b) => a.pris - b.pris || efterNavn(a, b));
  } else {
    aktive.sort(
      (a, b) =>
        Number(b.ofteBrugt) - Number(a.ofteBrugt) ||
        (a.ofteBrugt && b.ofteBrugt ? b.antal - a.antal : 0) ||
        efterNavn(a, b),
    );
  }
  const arkiverede = fundne.filter((k) => k.arkiveret).sort(efterNavn);
  return { aktive, arkiverede };
}

/** The Pris field as whole kroner above 0 ("1.250" is fine), or null. */
export function parsePris(input: string): number | null {
  const tal = input.trim().replace(/\.(?=\d{3}(\D|$))/g, '');
  if (!/^\d+$/.test(tal)) return null;
  const pris = Number(tal);
  return pris > 0 && Number.isSafeInteger(pris) && pris <= 2_147_483_647 ? pris : null;
}

const dagMaaned = new Intl.DateTimeFormat('da', { timeZone: 'Europe/Copenhagen', day: 'numeric', month: 'short' });
const aar = new Intl.DateTimeFormat('da', { timeZone: 'Europe/Copenhagen', year: 'numeric' });

/** A short Danish date, "12. aug", with the year added when it isn't this year. */
export function kortDato(iso: string, nu: Date = new Date()): string {
  const dato = new Date(iso);
  const kort = dagMaaned.format(dato).replace(/\.$/, '');
  const detAar = aar.format(dato);
  return detAar === aar.format(nu) ? kort : `${kort} ${detAar}`;
}

/** The creator and Admins may edit, archive and bring back a Bødekategori. */
export function kanRette(kategori: { oprettetAf: string }, mig: { medlemId: string; erAdmin: boolean }): boolean {
  return mig.erAdmin || kategori.oprettetAf === mig.medlemId;
}
