import { describe, expect, it } from 'vitest';
import { gangeTekst, gebyrVedOprettelse, parseGange, rensMobilePay } from './indstillinger.ts';

describe('gebyrVedOprettelse', () => {
  it('is the amount when the rule is on and a Sæson runs', () => {
    expect(gebyrVedOprettelse({ oprettelsesgebyr_til: true, oprettelsesgebyr: 25 }, false)).toBe(25);
  });

  it('is nothing when the rule is off', () => {
    expect(gebyrVedOprettelse({ oprettelsesgebyr_til: false, oprettelsesgebyr: 25 }, false)).toBeNull();
  });

  it('is nothing in a Pause', () => {
    expect(gebyrVedOprettelse({ oprettelsesgebyr_til: true, oprettelsesgebyr: 25 }, true)).toBeNull();
  });
});

describe('rensMobilePay', () => {
  it('trims and keeps single spaces', () => {
    expect(rensMobilePay('  1234   5678 ')).toEqual({ ok: true, vaerdi: '1234 5678' });
  });

  it('turns an empty field into no number', () => {
    expect(rensMobilePay('   ')).toEqual({ ok: true, vaerdi: null });
  });

  it('rejects letters', () => {
    expect(rensMobilePay('12ab')).toEqual({ ok: false });
  });

  it('rejects more than 20 characters', () => {
    expect(rensMobilePay('1234 5678 9012 3456 78')).toEqual({ ok: false });
  });
});

describe('the Anke max multiple', () => {
  it('reads a number of at least 1, with a Danish or English decimal mark', () => {
    expect(parseGange('2')).toBe(2);
    expect(parseGange(' 1,5 ')).toBe(1.5);
    expect(parseGange('2.25')).toBe(2.25);
    expect(parseGange('1')).toBe(1);
  });

  it('rejects less than 1, more than 2 decimals, and text', () => {
    expect(parseGange('0,5')).toBeNull();
    expect(parseGange('1,555')).toBeNull();
    expect(parseGange('to')).toBeNull();
    expect(parseGange('')).toBeNull();
  });

  it('shows with a Danish decimal comma', () => {
    expect(gangeTekst(1.5)).toBe('1,5');
    expect(gangeTekst(2)).toBe('2');
  });
});
