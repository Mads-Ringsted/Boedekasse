import { describe, expect, it } from 'vitest';
import {
  gangeTekst,
  gebyrVedOprettelse,
  parseBetalingsdag,
  parseGange,
  rensLoft,
  rensMobilePay,
  tjekEngangsPris,
} from './indstillinger.ts';

describe('parseBetalingsdag', () => {
  it('takes a whole day 1–28', () => {
    expect(parseBetalingsdag('1')).toBe(1);
    expect(parseBetalingsdag(' 28 ')).toBe(28);
  });

  it('rejects anything else, 29–31 included', () => {
    expect(parseBetalingsdag('0')).toBeNull();
    expect(parseBetalingsdag('29')).toBeNull();
    expect(parseBetalingsdag('5,5')).toBeNull();
    expect(parseBetalingsdag('')).toBeNull();
  });
});

describe('rensLoft (the optional monthly cap on late fees)', () => {
  it('empty means no cap', () => {
    expect(rensLoft('  ')).toEqual({ ok: true, vaerdi: null });
  });

  it('takes whole kroner above 0', () => {
    expect(rensLoft(' 200 ')).toEqual({ ok: true, vaerdi: 200 });
    expect(rensLoft('0')).toEqual({ ok: false });
    expect(rensLoft('abc')).toEqual({ ok: false });
  });
});

describe('tjekEngangsPris (saving the Engangsbøde price mode)', () => {
  it('Fri needs no amount and keeps the stored one for later', () => {
    expect(tjekEngangsPris('fri', '')).toEqual({ ok: true, aendringer: { engangs_pris_mode: 'fri' } });
    expect(tjekEngangsPris('fri', 'abc')).toEqual({ ok: true, aendringer: { engangs_pris_mode: 'fri' } });
  });

  it('Fast and Loft save the mode with the amount', () => {
    expect(tjekEngangsPris('fast', '30')).toEqual({
      ok: true,
      aendringer: { engangs_pris_mode: 'fast', engangs_pris: 30 },
    });
    expect(tjekEngangsPris('loft', ' 1.000 ')).toEqual({
      ok: true,
      aendringer: { engangs_pris_mode: 'loft', engangs_pris: 1000 },
    });
  });

  it('Fast and Loft without an amount are rejected', () => {
    expect(tjekEngangsPris('fast', '')).toEqual({ ok: false, fejl: 'mangler' });
    expect(tjekEngangsPris('loft', '  ')).toEqual({ ok: false, fejl: 'mangler' });
  });

  it('rejects an amount that is not whole kroner above 0', () => {
    expect(tjekEngangsPris('fast', '0')).toEqual({ ok: false, fejl: 'ugyldig' });
    expect(tjekEngangsPris('loft', '12,5')).toEqual({ ok: false, fejl: 'ugyldig' });
  });
});

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
