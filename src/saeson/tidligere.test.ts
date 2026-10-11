import { describe, expect, it } from 'vitest';
import { saesonPeriode } from './tidligere.ts';

// 11 Oct 2026, 14:00 in Copenhagen (summer time, UTC+2).
const nu = new Date('2026-10-11T12:00:00Z');

describe('saesonPeriode (start and end dates in the Sæson picker)', () => {
  it('shows a running Sæson from its start', () => {
    expect(saesonPeriode({ startet: '2026-01-04T10:00:00Z', slutter: null }, nu)).toBe('Fra 4. jan · kører');
  });

  it('still shows a Sæson with an end date ahead as running', () => {
    expect(saesonPeriode({ startet: '2026-01-04T10:00:00Z', slutter: '2026-12-20T23:00:00Z' }, nu)).toBe(
      'Fra 4. jan · kører',
    );
  });

  it('shows an ended Sæson from its start to its last day', () => {
    // Ended by date: it ends at Copenhagen midnight after 30 Sep.
    expect(saesonPeriode({ startet: '2026-01-04T10:00:00Z', slutter: '2026-09-30T22:00:00Z' }, nu)).toBe(
      '4. jan – 30. sep',
    );
  });

  it('adds the year to dates outside this year', () => {
    expect(saesonPeriode({ startet: '2025-03-01T10:00:00Z', slutter: '2026-01-03T18:30:00Z' }, nu)).toBe(
      '1. mar 2025 – 3. jan',
    );
  });
});
