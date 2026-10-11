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
  'skaerm.profil': 'Profil',
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

  // Log ind
  'logInd.titel': 'Log ind',
  'logInd.intro': 'Vi sender en kode til din email.',
  'logInd.email': 'Email',
  'logInd.sendKode': 'Send kode',
  'logInd.tjekMail': 'Tjek din mail',
  'logInd.kodeSendt': 'Vi har sendt en kode på 6 cifre til {email}',
  'logInd.kodeLabel': 'Kode på 6 cifre',
  'logInd.sendNyKode': 'Send ny kode',
  'logInd.sendNyKodeOm': 'Send ny kode om {sekunder} s',
  'logInd.nyKodeSendt': 'Ny kode sendt',
  'logInd.fejl.forkertKode': 'Koden er forkert eller udløbet. Prøv igen, eller få en ny kode.',
  'logInd.fejl.forHurtigt': 'Vent et øjeblik, før du beder om en ny kode.',
  'logInd.fejl.email': 'Tjek at din email er skrevet rigtigt.',
  'logUd': 'Log ud',

  // Velkommen (logged in, in no box yet)
  'velkommen.titel': 'Velkommen',
  'velkommen.intro': 'Du er ikke med i en Bødekasse endnu.',
  'velkommen.loggetIndSom': 'Logget ind som {email}',
  'velkommen.opret': 'Opret Bødekasse',
  'velkommen.opretTekst': 'Start en ny og bliv Admin',
  'velkommen.kode': 'Jeg har en kode',
  'velkommen.kodeTekst': 'Kom med i en, der findes',

  // Opret Bødekasse
  'opret.titel': 'Opret Bødekasse',
  'opret.navn': 'Navn på Bødekassen',
  'opret.mitNavn': 'Dit navn i Bødekassen',
  'opret.note': 'Du bliver Admin. Bagefter kan du invitere de andre med en kode.',
  'opret.knap': 'Opret',

  // Jeg har en kode
  'kode.titel': 'Jeg har en kode',

  // Vælg Bødekasse / Skift Bødekasse
  'vaelg.titel': 'Vælg Bødekasse',
  'vaelg.antalMedlemmer': '{antal} medlemmer',
  'vaelg.etMedlem': '1 medlem',
  'vaelg.opretNy': 'Opret ny',
  'vaelg.kode': 'Jeg har en kode',
  'vaelg.aaben': 'Åben',
  'skift.titel': 'Skift Bødekasse',

  // Hjem
  'hjem.label': 'Bødekasse',
  'hjem.skift': 'Skift Bødekasse',
  'hjem.iBoedekassen': 'I bødekassen',
  'hjem.komIGang': 'Kom i gang',
  'hjem.trin.opret': 'Opret Bødekassen',
  'hjem.trin.inviter': 'Invitér de andre',
  'hjem.trin.inviterKode': 'Del koden {kode}',
  'hjem.trin.inviterUdenKode': 'En Admin kan dele koden',
  'hjem.trin.kategorier': 'Lav jeres bødekategorier',
  'hjem.trin.kategorierTekst': 'Fx For sent · {beloeb}',
  'hjem.trin.boede': 'Giv den første bøde',
  'hjem.trin.boedeTekst': 'Med + nederst',
  'hjem.del': 'Del',
  'hjem.opretKategori': 'Opret',
  'hjem.topliste': 'Topliste',
  'hjem.toplisteTom': 'Ingen bøder endnu',
  'hjem.toplisteTomTekst': 'Her ser I, hvem der har fået flest.',

  // Inviting with the join code
  'invitation.tekst': 'Kom med i {navn} i Bødekasse. Åbn {url} og brug koden {kode}.',
  'invitation.kopieret': 'Invitationen er kopieret',

  // Mere
  'mere.seProfil': 'Se din profil',
  'mere.adminSeProfil': 'Admin · Se din profil',
  'mere.medlemmer': 'Medlemmer',
  'mere.kassen': 'Kassen og indbetalinger',
  'mere.anker': 'Anker',
  'mere.konkurrencer': 'Konkurrencer',
  'mere.indstillinger': 'Indstillinger',
  'mere.admin': 'Admin',
  'mere.skift': 'Skift Bødekasse',

  // General
  'fejl.ukendt': 'Noget gik galt. Prøv igen.',
  'fejl.navnMangler': 'Skriv et navn til Bødekassen.',
  'fejl.mitNavnMangler': 'Skriv dit navn.',
  'handling.proevIgen': 'Prøv igen',

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
