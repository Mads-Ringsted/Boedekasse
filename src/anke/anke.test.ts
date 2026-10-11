import { describe, expect, it } from 'vitest';
import type { Boede } from '../aktivitet/haendelse.ts';
import { ankeVindue, gebyrInterval, tilbageTekst, type AnkeRegler } from './anke.ts';
import { ankerRaekke } from './anker.ts';

const nu = new Date('2026-10-11T18:00:00Z');

const regler: AnkeRegler = { til: true, vindueTimer: 24, min: 1, maxGange: 2, aktivSaesonId: 's1' };

const boede = (over: Partial<Boede> = {}): Boede => ({
  id: 'b1',
  saesonId: 's1',
  batchId: 'batch',
  giverId: 'frederik',
  giverNavn: 'Frederik Lund',
  modtagerId: 'emil',
  modtagerNavn: 'Emil Bach',
  bodekategoriId: 'k1',
  navn: 'For sent',
  engangsbode: false,
  pris: 50,
  givet: '2026-10-11T13:00:00Z',
  ankeId: null,
  afgoerelse: null,
  anket: false,
  afgoerelseAendret: false,
  baererId: 'emil',
  annullering: null,
  gebyr: 0,
  afgjort: null,
  ankeGebyr: null,
  ...over,
});

describe('who may appeal a Bøde, and for how long', () => {
  it('lets the receiver appeal within the window, and says how long is left', () => {
    expect(ankeVindue(boede(), 'emil', regler, nu)).toEqual({ msTilbage: 19 * 3_600_000 });
  });

  it('is closed for anyone but the receiver', () => {
    expect(ankeVindue(boede(), 'frederik', regler, nu)).toBeNull();
    expect(ankeVindue(boede(), 'jonas', regler, nu)).toBeNull();
  });

  it('is closed once the window has passed, by the box setting', () => {
    const gammel = boede({ givet: '2026-10-10T17:00:00Z' });
    expect(ankeVindue(gammel, 'emil', regler, nu)).toBeNull();
    expect(ankeVindue(gammel, 'emil', { ...regler, vindueTimer: 48 }, nu)).toEqual({ msTilbage: 23 * 3_600_000 });
  });

  it('is closed when the rule is off, in a Pause, or for an earlier Sæson', () => {
    expect(ankeVindue(boede(), 'emil', { ...regler, til: false }, nu)).toBeNull();
    expect(ankeVindue(boede(), 'emil', { ...regler, aktivSaesonId: null }, nu)).toBeNull();
    expect(ankeVindue(boede(), 'emil', { ...regler, aktivSaesonId: 's2' }, nu)).toBeNull();
  });

  it('never opens twice, nor for an annulled Bøde (a Bøde moved by an Anke already has one)', () => {
    expect(ankeVindue(boede({ ankeId: 'a1', afgoerelse: 'modtager_vandt' }), 'emil', regler, nu)).toBeNull();
    expect(ankeVindue(boede({ ankeId: 'a1', anket: true }), 'emil', regler, nu)).toBeNull();
    const annulleret = { tid: '2026-10-11T17:00:00Z', afId: 'kasper', afNavn: 'Kasper', note: null };
    expect(ankeVindue(boede({ annullering: annulleret }), 'emil', regler, nu)).toBeNull();
  });
});

describe('the Anke Gebyr range', () => {
  it('runs from the minimum to the multiple of the kept price, in whole kroner', () => {
    expect(gebyrInterval(50, regler)).toEqual({ min: 1, max: 100 });
    expect(gebyrInterval(25, { ...regler, maxGange: 1.5 })).toEqual({ min: 1, max: 37 });
    expect(gebyrInterval(10, { ...regler, maxGange: 2.3 })).toEqual({ min: 1, max: 23 });
  });

  it('never drops below the minimum', () => {
    expect(gebyrInterval(20, { ...regler, min: 30, maxGange: 1 })).toEqual({ min: 30, max: 30 });
  });
});

describe('time left to appeal', () => {
  it('counts whole hours, then minutes in the last hour', () => {
    expect(tilbageTekst(19 * 3_600_000 + 59 * 60_000)).toBe('19 timer');
    expect(tilbageTekst(3_600_000 + 1)).toBe('1 time');
    expect(tilbageTekst(45 * 60_000 + 30_000)).toBe('45 min');
    expect(tilbageTekst(20_000)).toBe('1 min');
  });
});

describe('a row on Mere → Anker', () => {
  it('says who appealed whose Bøde, with its price, and opens the Bøde', () => {
    expect(ankerRaekke(boede({ ankeId: 'a1', anket: true }), { migId: 'jonas' }, nu)).toMatchObject({
      titel: 'Emil ankede Frederiks bøde',
      linje: 'For sent · 5 t',
      beloeb: { tekst: '50 kr' },
      boedeId: 'b1',
      annulleret: false,
    });
    expect(ankerRaekke(boede({ ankeId: 'a1', anket: true }), { migId: 'frederik' }, nu).titel).toBe(
      'Emil ankede din bøde',
    );
  });
});
