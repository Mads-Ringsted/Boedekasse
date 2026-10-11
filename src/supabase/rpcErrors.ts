import { t, type PlainStringId } from '../strings/index.ts';

/**
 * RPC error keys (`raise exception '<key>'` in the migrations) and their
 * Danish text. Add your RPC's keys here.
 */
const BY_KEY: Record<string, PlainStringId> = {
  navn_mangler: 'fejl.navnMangler',
  mit_navn_mangler: 'fejl.mitNavnMangler',
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
