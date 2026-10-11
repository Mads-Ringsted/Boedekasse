import { describe, expect, it } from 'vitest';
import { iDagIKoebenhavn, koerer, msTilSlut, pauseLinje, slutdatoTekst, tjekSlutdato } from './saeson.ts';

const saeson = (over: Partial<{ navn: string; slutdato: string | null; slutter: string | null }> = {}) => ({
  id: 's1',
  navn: 'Sæson 2026',
  slutdato: null,
  slutter: null,
  ...over,
});

// 11 Oct 2026, 14:00 in Copenhagen (summer time, UTC+2).
const nu = new Date('2026-10-11T12:00:00Z');

describe('koerer (is the latest Sæson running?)', () => {
  it('runs with no end', () => {
    expect(koerer(saeson(), nu)).toBe(true);
  });

  it('runs until its end time, then it is a Pause', () => {
    const s = saeson({ slutdato: '2026-10-11', slutter: '2026-10-11T22:00:00+00:00' });
    expect(koerer(s, nu)).toBe(true);
    expect(koerer(s, new Date('2026-10-11T22:00:00Z'))).toBe(false);
  });

  it('a box with no Sæson is in Pause', () => {
    expect(koerer(null, nu)).toBe(false);
  });
});

describe('msTilSlut (when to re-check the Pause)', () => {
  it('is the time left until the end, or null when there is none or it is past', () => {
    expect(msTilSlut(saeson({ slutter: '2026-10-11T13:00:00Z' }), nu)).toBe(3_600_000);
    expect(msTilSlut(saeson(), nu)).toBeNull();
    expect(msTilSlut(saeson({ slutter: '2026-10-11T11:00:00Z' }), nu)).toBeNull();
  });
});

describe('pauseLinje (the Pause card)', () => {
  it('names the last day of a Sæson that ended by its date', () => {
    const s = saeson({ slutdato: '2026-09-30', slutter: '2026-09-30T22:00:00+00:00' });
    expect(pauseLinje(s, nu)).toBe('Sæson 2026 sluttede 30. sep');
  });

  it('names the day an Admin ended it', () => {
    const s = saeson({ slutdato: '2026-12-20', slutter: '2026-10-10T19:30:00+00:00' });
    expect(pauseLinje(s, nu)).toBe('Sæson 2026 sluttede 10. okt');
  });
});

describe('slutdatoTekst (the end date row)', () => {
  it('shows a short date, or that there is none', () => {
    expect(slutdatoTekst('2026-12-20', nu)).toBe('20. dec');
    expect(slutdatoTekst('2027-01-31', nu)).toBe('31. jan 2027');
    expect(slutdatoTekst(null, nu)).toBe('Ingen dato');
  });
});

describe('tjekSlutdato (the end date field)', () => {
  it('takes today or a later day', () => {
    expect(tjekSlutdato('2026-10-11', nu)).toEqual({ ok: true, vaerdi: '2026-10-11' });
    expect(tjekSlutdato('2026-12-20', nu)).toEqual({ ok: true, vaerdi: '2026-12-20' });
  });

  it('refuses a day in the past or no day', () => {
    expect(tjekSlutdato('2026-10-10', nu)).toEqual({ ok: false, fejl: 'Datoen må ikke ligge før i dag.' });
    expect(tjekSlutdato('', nu).ok).toBe(false);
  });

  it('uses the Copenhagen calendar', () => {
    // 23:30 UTC on 11 Oct is already 12 Oct in Copenhagen.
    expect(iDagIKoebenhavn(new Date('2026-10-11T23:30:00Z'))).toBe('2026-10-12');
  });
});
