import { describe, expect, it } from 'vitest';
import { readEmailLink } from './emailLink.ts';

describe('readEmailLink (email bekræftet or install guide)', () => {
  it('shows the install guide on a plain visit', () => {
    expect(readEmailLink('', '')).toBe(null);
    expect(readEmailLink('?installer', '')).toBe(null);
  });

  it('sees a confirmed signup in the hash', () => {
    expect(readEmailLink('', '#access_token=abc&refresh_token=def&type=signup')).toBe('bekraeftet');
  });

  it('sees a confirmed signup as a PKCE code', () => {
    expect(readEmailLink('?code=abc', '')).toBe('bekraeftet');
  });

  it('sees a used or expired link', () => {
    expect(
      readEmailLink('', '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid'),
    ).toBe('fejl');
    expect(readEmailLink('?error=access_denied&error_code=otp_expired', '')).toBe('fejl');
  });
});
