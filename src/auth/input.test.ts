import { describe, expect, it } from 'vitest';
import { cleanCode, normalizeEmail, looksLikeEmail } from './input.ts';

describe('cleanCode (what lands in the six digit boxes)', () => {
  it('keeps typed digits', () => {
    expect(cleanCode('4829')).toBe('4829');
  });

  it('drops spaces and other characters from autofill or paste', () => {
    expect(cleanCode('482 913')).toBe('482913');
    expect(cleanCode('Kode: 48-29-13')).toBe('482913');
  });

  it('never holds more than six digits', () => {
    expect(cleanCode('4829135')).toBe('482913');
  });
});

describe('email input', () => {
  it('trims and lowercases, as the claim matches lowercased emails', () => {
    expect(normalizeEmail('  Mads@Example.COM ')).toBe('mads@example.com');
  });

  it('only enables "Send kode" for something shaped like an email', () => {
    expect(looksLikeEmail('mads@example.com')).toBe(true);
    expect(looksLikeEmail(' Mads@Example.com ')).toBe(true);
    expect(looksLikeEmail('mads')).toBe(false);
    expect(looksLikeEmail('mads@')).toBe(false);
    expect(looksLikeEmail('mads@example')).toBe(false);
    expect(looksLikeEmail('ma ds@example.com')).toBe(false);
  });
});
