import { describe, expect, it } from 'vitest';
import { kanHaandterePenge } from './roller.ts';

describe('kanHaandterePenge (may handle the money)', () => {
  it('is true for an Admin and for a Kasserer, false for a plain Medlem', () => {
    expect(kanHaandterePenge({ erAdmin: true, erKasserer: false })).toBe(true);
    expect(kanHaandterePenge({ erAdmin: false, erKasserer: true })).toBe(true);
    expect(kanHaandterePenge({ erAdmin: false, erKasserer: false })).toBe(false);
  });
});
