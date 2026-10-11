import { t, type PlainStringId } from '../strings/index.ts';

/**
 * RPC error keys (`raise exception '<key>'` in the migrations) and their
 * Danish text. Add your RPC's keys here.
 */
const BY_KEY: Record<string, PlainStringId> = {
  navn_mangler: 'fejl.navnMangler',
  mit_navn_mangler: 'fejl.mitNavnMangler',
  // Medlemmer (#51)
  medlem_navn_mangler: 'fejl.medlemNavnMangler',
  email_mangler: 'fejl.emailMangler',
  email_ugyldig: 'fejl.emailUgyldig',
  email_findes: 'fejl.emailFindes',
  kode_ukendt: 'fejl.kodeUkendt',
  udmeldt: 'fejl.udmeldt',
  ikke_admin: 'fejl.ikkeAdmin',
  // Bødekategorier (#52)
  kategorinavn_mangler: 'fejl.kategorinavnMangler',
  navn_findes: 'fejl.navnFindes',
  pris_ugyldig: 'fejl.prisUgyldig',
  ikke_tilladt: 'fejl.ikkeTilladt',
  arkiveret: 'fejl.kategoriArkiveret',
  ikke_fundet: 'fejl.ikkeFundet',
  // Giv bøder and Fortryd (#53)
  pause: 'fejl.pause',
  ingen_boeder: 'fejl.ingenBoeder',
  modtager_ukendt: 'fejl.modtagerUkendt',
  modtager_udmeldt: 'fejl.modtagerUdmeldt',
  ikke_dig_selv: 'fejl.ikkeDigSelv',
  antal_ugyldig: 'fejl.antalUgyldig',
  fortryd_udloebet: 'fejl.fortrydUdloebet',
  kan_ikke_fortrydes: 'fejl.kanIkkeFortrydes',
  // Engangsbøde (#58); beloeb_ugyldig is shared with #59
  grund_mangler: 'fejl.grundMangler',
  grund_for_lang: 'fejl.grundForLang',
  // Kassen and Registrér indbetaling (#59)
  medlem_ukendt: 'fejl.medlemUkendt',
  beloeb_ugyldig: 'fejl.beloebUgyldig',
  allerede_annulleret: 'fejl.alleredeAnnulleret',
  tidligere_saeson: 'fejl.tidligereSaeson',
  // Indstillinger (#57)
  indstilling_ugyldig: 'fejl.indstillingUgyldig',
  indstilling_ukendt: 'fejl.indstillingUgyldig',
  mobilepay_ugyldig: 'fejl.mobilepayUgyldig',
};

/**
 * The Danish message for an error from `supabase.rpc()` (or a failed read).
 * Keeps no import of the client, so it is testable in plain Vitest.
 */
export function rpcErrorText(error: unknown): string {
  if (error instanceof TypeError) return t('offline.proevIgen');
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const { message, code } = error as { message: unknown; code?: unknown };
    // supabase-js reports a request that never got an answer with an empty code.
    if (code === '') return t('offline.proevIgen');
    if (typeof message === 'string' && message in BY_KEY) return t(BY_KEY[message]);
  }
  return t('fejl.ukendt');
}
