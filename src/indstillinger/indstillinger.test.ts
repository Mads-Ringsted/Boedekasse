import { describe, expect, it } from 'vitest';
import { gebyrVedOprettelse, rensMobilePay } from './indstillinger.ts';

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
