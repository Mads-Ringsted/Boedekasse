/**
 * The Danish string catalogue. Every UI text lives here, keyed by id.
 * Placeholders are written `{name}` and filled by `t()` / `tParts()`.
 * Format amounts with `formatKr()` before passing them in.
 */
export const da = {
  'app.navn': 'Bødekasse',

  // Tab bar
  'tab.faner': 'Faner',
  'tab.hjem': 'Hjem',
  'tab.aktivitet': 'Aktivitet',
  'tab.givBoeder': 'Giv bøder',
  'tab.kategorier': 'Kategorier',
  'tab.mere': 'Mere',

  // Screen titles
  'skaerm.hjem': 'Hjem',
  'skaerm.aktivitet': 'Aktivitet',
  'skaerm.kategorier': 'Bødekategorier',
  'skaerm.mere': 'Mere',
  'skaerm.kommerSnart': 'Kommer snart',

  // Install guide (opened in a Safari tab)
  'installer.intro': 'Læg appen på hjemmeskærmen for at komme i gang.',
  'installer.trin1': 'Tryk på {del}',
  'installer.del': 'Del',
  'installer.trin2': 'Vælg {foej}',
  'installer.foejTilHjemmeskaerm': 'Føj til hjemmeskærm',
  'installer.trin3': 'Åbn {app} fra hjemmeskærmen',
  'installer.krav': 'Kræver iOS 17.5 eller nyere.',
  'installer.delKnappen': 'Del-knappen er nederst i Safari',

  // Offline
  'offline.titel': 'Ingen forbindelse',
  'offline.tekst': 'Appen virker igen, så snart du er online.',
  'offline.proevIgen': 'Ingen forbindelse – prøv igen',

  // App update
  'opdatering.klar': 'Ny version klar',
  'opdatering.genindlaes': 'Genindlæs',

  // Sheets
  'sheet.luk': 'Luk',
  'sheet.annuller': 'Annullér',
  'sheet.tilbage': 'Tilbage',

  // Giv bøder
  'giv.titel': 'Giv bøder',
  'giv.naeste': 'Næste · {antal} valgt',

  // Money
  'betaling.harBetalt': '{navn} har betalt {beloeb}',
} as const;

export type Catalogue = typeof da;
