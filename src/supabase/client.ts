import { createClient } from '@supabase/supabase-js';
import { readSupabaseConfig } from './config.ts';
import type { Database } from './database.types.ts';

const { url, publishableKey } = readSupabaseConfig(import.meta.env);

/**
 * The one Supabase client. The session lives in localStorage (the installed
 * app's own storage) and refreshes itself, so a Medlem stays logged in for
 * good. Reads go through RLS'd tables/views; writes only through RPCs.
 */
export const supabase = createClient<Database>(url, publishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false, // codes only, never links
  },
});
