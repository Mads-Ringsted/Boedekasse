export interface SupabaseConfig {
  url: string;
  publishableKey: string;
}

/**
 * Reads which Supabase project to use from the Vite env.
 * Local dev uses `.env.development` (the local stack); production builds
 * get the values from Vercel's env vars. See `.env.example`.
 */
export function readSupabaseConfig(env: Record<string, string | undefined>): SupabaseConfig {
  const url = env.VITE_SUPABASE_URL?.trim() ?? '';
  const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? '';
  const missing = [
    !url && 'VITE_SUPABASE_URL',
    !publishableKey && 'VITE_SUPABASE_PUBLISHABLE_KEY',
  ].filter(Boolean);
  if (missing.length) {
    throw new Error(`Supabase is not configured. Missing: ${missing.join(', ')} (see .env.example)`);
  }
  return { url, publishableKey };
}
