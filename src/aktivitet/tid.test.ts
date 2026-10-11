import { describe, expect, it } from 'vitest';
import { dagOverskrift, givetTekst, iDage, siden } from './tid.ts';

// 11 Oct 2026, 20:00 in Copenhagen (summer time, UTC+2).
const nu = new Date('2026-10-11T18:00:00Z');

describe('siden', () => {
  it('says how long ago, in minutes, then hours', () => {
    expect(siden('2026-10-11T17:59:40Z', nu)).toBe('Lige nu');
    expect(siden('2026-10-11T17:25:00Z', nu)).toBe('35 min');
    expect(siden('2026-10-11T13:00:00Z', nu)).toBe('5 t');
  });

  it('gives a date once it is a day or more ago', () => {
    expect(siden('2026-10-09T12:00:00Z', nu)).toBe('9. okt');
  });
});

describe('dagOverskrift', () => {
  it('names today and yesterday by Copenhagen days', () => {
    expect(dagOverskrift('2026-10-10T22:30:00Z', nu)).toBe('I dag'); // 00:30 on the 11th
    expect(dagOverskrift('2026-10-10T21:30:00Z', nu)).toBe('I går'); // 23:30 on the 10th
  });

  it('names the weekday within the last week, then the date', () => {
    expect(dagOverskrift('2026-10-07T10:00:00Z', nu)).toBe('Onsdag');
    expect(dagOverskrift('2026-10-01T10:00:00Z', nu)).toBe('1. okt');
  });
});

describe('iDage', () => {
  it('groups entries (newest first) under one heading per Copenhagen day', () => {
    const tider = ['2026-10-11T17:00:00Z', '2026-10-10T22:30:00Z', '2026-10-10T21:30:00Z', '2026-10-10T08:00:00Z'];
    const dage = iDage(tider.map((tid, id) => ({ id, tid })), nu);
    expect(dage.map((d) => [d.overskrift, d.poster.map((p) => p.id)])).toEqual([
      ['I dag', [0, 1]],
      ['I går', [2, 3]],
    ]);
  });
});

describe('givetTekst', () => {
  it('gives the day and the clock time', () => {
    expect(givetTekst('2026-10-11T16:42:00Z', nu)).toBe('I dag kl. 18.42');
    expect(givetTekst('2026-10-10T07:05:00Z', nu)).toBe('I går kl. 09.05');
    expect(givetTekst('2026-08-12T16:42:00Z', nu)).toBe('12. aug kl. 18.42');
  });
});
