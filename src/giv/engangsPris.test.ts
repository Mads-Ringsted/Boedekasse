import { describe, expect, it } from 'vitest';
import { begraensBeloeb, engangsBeloeb, engangsPris } from './engangsPris.ts';

describe("engangsPris (the box's price mode as the sheet uses it)", () => {
  it('is Fri by default', () => {
    expect(engangsPris({ engangs_pris_mode: 'fri', engangs_pris: null })).toEqual({ mode: 'fri' });
  });

  it('ignores a stored amount in Fri', () => {
    expect(engangsPris({ engangs_pris_mode: 'fri', engangs_pris: 30 })).toEqual({ mode: 'fri' });
  });

  it('carries the fixed amount in Fast and the cap in Loft', () => {
    expect(engangsPris({ engangs_pris_mode: 'fast', engangs_pris: 30 })).toEqual({ mode: 'fast', beloeb: 30 });
    expect(engangsPris({ engangs_pris_mode: 'loft', engangs_pris: 50 })).toEqual({ mode: 'loft', loft: 50 });
  });
});

describe('engangsBeloeb (the amount the sheet adds)', () => {
  it('Fri: whatever whole amount is typed', () => {
    expect(engangsBeloeb({ mode: 'fri' }, '1.250')).toBe(1250);
    expect(engangsBeloeb({ mode: 'fri' }, '')).toBeNull();
    expect(engangsBeloeb({ mode: 'fri' }, '0')).toBeNull();
  });

  it('Fast: always the fixed amount, with nothing typed', () => {
    expect(engangsBeloeb({ mode: 'fast', beloeb: 30 }, '')).toBe(30);
    expect(engangsBeloeb({ mode: 'fast', beloeb: 30 }, '100')).toBe(30);
  });

  it('Loft: up to and including the cap', () => {
    expect(engangsBeloeb({ mode: 'loft', loft: 50 }, '50')).toBe(50);
    expect(engangsBeloeb({ mode: 'loft', loft: 50 }, '20')).toBe(20);
    expect(engangsBeloeb({ mode: 'loft', loft: 50 }, '51')).toBeNull();
    expect(engangsBeloeb({ mode: 'loft', loft: 50 }, '')).toBeNull();
  });
});

describe('begraensBeloeb (typing in the amount field)', () => {
  it('Loft: refuses a keystroke that goes above the cap', () => {
    expect(begraensBeloeb({ mode: 'loft', loft: 50 }, '5', '50')).toBe('50');
    expect(begraensBeloeb({ mode: 'loft', loft: 50 }, '5', '55')).toBe('5');
    expect(begraensBeloeb({ mode: 'loft', loft: 50 }, '50', '500')).toBe('50');
  });

  it('Loft: lets the field be emptied or hold text that is not yet a number', () => {
    expect(begraensBeloeb({ mode: 'loft', loft: 50 }, '5', '')).toBe('');
    expect(begraensBeloeb({ mode: 'loft', loft: 50 }, '', 'x')).toBe('x');
  });

  it('Fri: takes anything typed', () => {
    expect(begraensBeloeb({ mode: 'fri' }, '5', '5000')).toBe('5000');
  });
});
