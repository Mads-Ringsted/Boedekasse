import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { authErrorText } from './errors.ts';

// Errors as the local Supabase Auth server really returns them.
describe('authErrorText (a clear Danish message for a failed login step)', () => {
  it('explains a wrong or expired code', () => {
    const error = new AuthApiError('Token has expired or is invalid', 403, 'otp_expired');
    expect(authErrorText(error)).toBe('Koden er forkert eller udløbet. Prøv igen, eller få en ny kode.');
  });

  it('asks the person to wait when codes come too fast', () => {
    const error = new AuthApiError('For security purposes…', 429, 'over_email_send_rate_limit');
    expect(authErrorText(error)).toBe('Vent et øjeblik, før du beder om en ny kode.');
    expect(authErrorText(new AuthApiError('Too many', 429, 'over_request_rate_limit'))).toBe(
      'Vent et øjeblik, før du beder om en ny kode.',
    );
  });

  it('points at the email when the server rejects it', () => {
    const error = new AuthApiError('Unable to validate email address: invalid format', 400, 'validation_failed');
    expect(authErrorText(error)).toBe('Tjek at din email er skrevet rigtigt.');
  });

  it('says "no connection" when the request never got through', () => {
    expect(authErrorText(new AuthRetryableFetchError('Failed to fetch', 0))).toBe('Ingen forbindelse – prøv igen');
    expect(authErrorText(new TypeError('Failed to fetch'))).toBe('Ingen forbindelse – prøv igen');
  });

  it('falls back to a general message for anything else', () => {
    expect(authErrorText(new AuthApiError('boom', 500, 'unexpected_failure'))).toBe(
      'Noget gik galt. Prøv igen.',
    );
  });
});
