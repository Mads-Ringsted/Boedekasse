import { describe, expect, it } from 'vitest';
import { readSupabaseConfig } from './config.ts';

describe('readSupabaseConfig (which Supabase the app talks to)', () => {
  it('reads the URL and publishable key from the Vite env', () => {
    expect(
      readSupabaseConfig({
        VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_abc',
      }),
    ).toEqual({ url: 'http://127.0.0.1:54321', publishableKey: 'sb_publishable_abc' });
  });

  it('names the missing variables, so a bad deploy is easy to spot', () => {
    expect(() => readSupabaseConfig({ VITE_SUPABASE_URL: 'https://x.supabase.co' })).toThrow(
      /VITE_SUPABASE_PUBLISHABLE_KEY/,
    );
    expect(() => readSupabaseConfig({ VITE_SUPABASE_URL: ' ', VITE_SUPABASE_PUBLISHABLE_KEY: '' })).toThrow(
      /VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY/,
    );
  });
});
