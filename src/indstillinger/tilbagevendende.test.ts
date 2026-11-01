import { describe, expect, it } from 'vitest';
import { frekvensTekst, naesteForekomst, tjekRegel } from './tilbagevendende.ts';

describe('frekvensTekst', () => {
  it('names the weekday of a weekly rule (1 = mandag)', () => {
    expect(frekvensTekst('uge', 1)).toBe('Hver mandag');
    expect(frekvensTekst('uge', 7)).toBe('Hver søndag');
  });

  it('names the day of a monthly rule', () => {
    expect(frekvensTekst('maaned', 15)).toBe('Den 15. hver måned');
  });
});

describe('naesteForekomst (the next charge, by the Copenhagen calendar)', () => {
  // Monday 2 March 2026, 12:00 in Copenhagen.
  const mandag = new Date('2026-03-02T11:00:00Z');

  it('is never today: a rule made or edited today counts from tomorrow', () => {
    expect(naesteForekomst('uge', 1, mandag)).toBe('2026-03-09');
    expect(naesteForekomst('maaned', 2, mandag)).toBe('2026-04-02');
  });

  it('is the next matching weekday or day of the month', () => {
    expect(naesteForekomst('uge', 3, mandag)).toBe('2026-03-04');
    expect(naesteForekomst('maaned', 28, mandag)).toBe('2026-03-28');
    expect(naesteForekomst('maaned', 1, mandag)).toBe('2026-04-01');
  });

  it('crosses the year', () => {
    expect(naesteForekomst('maaned', 5, new Date('2026-12-20T12:00:00Z'))).toBe('2027-01-05');
  });

  it('uses the Danish date around midnight', () => {
    // 23:30 UTC on 1 March is 00:30 on Monday 2 March in Copenhagen.
    expect(naesteForekomst('uge', 1, new Date('2026-03-01T23:30:00Z'))).toBe('2026-03-09');
    // 22:30 UTC is still 23:30 on Sunday 1 March.
    expect(naesteForekomst('uge', 1, new Date('2026-03-01T22:30:00Z'))).toBe('2026-03-02');
  });
});

describe('tjekRegel (saving a Tilbagevendende Gebyr)', () => {
  const gyldig = { navn: ' Kontingent ', beloeb: '1.000', frekvens: 'uge', dag: 1, medlemmer: ['a', 'b'] } as const;

  it('trims the name and reads the amount', () => {
    expect(tjekRegel(gyldig)).toEqual({
      ok: true,
      vaerdi: { navn: 'Kontingent', beloeb: 1000, frekvens: 'uge', dag: 1, medlemmer: ['a', 'b'] },
    });
  });

  it('needs a name', () => {
    expect(tjekRegel({ ...gyldig, navn: '  ' })).toEqual({ ok: false, fejl: 'navn' });
  });

  it('needs whole kroner above 0', () => {
    expect(tjekRegel({ ...gyldig, beloeb: '0' })).toEqual({ ok: false, fejl: 'beloeb' });
    expect(tjekRegel({ ...gyldig, beloeb: '12,5' })).toEqual({ ok: false, fejl: 'beloeb' });
  });

  it('needs a weekday 1-7 or a day of the month 1-28', () => {
    expect(tjekRegel({ ...gyldig, dag: 8 })).toEqual({ ok: false, fejl: 'dag' });
    expect(tjekRegel({ ...gyldig, frekvens: 'maaned', dag: 28 }).ok).toBe(true);
    expect(tjekRegel({ ...gyldig, frekvens: 'maaned', dag: 29 })).toEqual({ ok: false, fejl: 'dag' });
  });

  it('needs at least one Medlem', () => {
    expect(tjekRegel({ ...gyldig, medlemmer: [] })).toEqual({ ok: false, fejl: 'medlemmer' });
  });
});
