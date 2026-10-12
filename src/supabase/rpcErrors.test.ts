import { describe, expect, it } from 'vitest';
import { rpcErrorText } from './rpcErrors.ts';

// Errors shaped as supabase-js returns them from `supabase.rpc()`.
describe('rpcErrorText (a clear Danish message for a failed save)', () => {
  it('explains a rule the server refused, by its key', () => {
    expect(rpcErrorText({ message: 'navn_mangler', code: 'P0001', details: '', hint: '' })).toBe(
      'Skriv et navn til Bødekassen.',
    );
    expect(rpcErrorText({ message: 'mit_navn_mangler', code: 'P0001', details: '', hint: '' })).toBe(
      'Skriv dit navn.',
    );
  });

  it('explains the Medlemmer and join-code rules', () => {
    const fejl = (message: string) => rpcErrorText({ message, code: 'P0001', details: '', hint: '' });
    expect(fejl('email_findes')).toBe('Der er allerede et medlem med den email.');
    expect(fejl('kode_ukendt')).toBe('Koden findes ikke. Tjek den og prøv igen.');
    expect(fejl('udmeldt')).toBe('Du er meldt ud af denne Bødekasse. Bed en Admin om at genoptage dig.');
    expect(rpcErrorText({ message: 'ikke_admin', code: '42501', details: '', hint: '' })).toBe(
      'Det kan kun en Admin.',
    );
  });

  it('explains why Bøder cannot be given in a Pause', () => {
    expect(rpcErrorText({ message: 'pause', code: 'P0001', details: '', hint: '' })).toBe(
      'Sæsonen er slut. Der kan ikke gives bøder i en pause.',
    );
  });

  it('says "no connection" when the request never got through', () => {
    expect(rpcErrorText({ message: 'TypeError: Failed to fetch', code: '', details: '', hint: '' })).toBe(
      'Ingen forbindelse – prøv igen',
    );
    expect(rpcErrorText(new TypeError('Load failed'))).toBe('Ingen forbindelse – prøv igen');
  });

  it('falls back to a general message for an unknown error', () => {
    expect(rpcErrorText({ message: 'duplicate key value', code: '23505', details: '', hint: '' })).toBe(
      'Noget gik galt. Prøv igen.',
    );
    expect(rpcErrorText(null)).toBe('Noget gik galt. Prøv igen.');
  });
});
