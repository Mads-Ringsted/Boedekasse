import { describe, expect, it } from 'vitest';
import type { Boede } from '../aktivitet/haendelse.ts';
import { afgoerelseValg, kanAendreAfgoerelse, kanRegistrereAfgoerelse, partIAnken } from './afgoerelse.ts';

const boede = (over: Partial<Boede> = {}): Boede => ({
  id: 'b1',
  saesonId: 's1',
  batchId: 'batch',
  giverId: 'jonas',
  giverNavn: 'Jonas Holm',
  modtagerId: 'emil',
  modtagerNavn: 'Emil Bach',
  bodekategoriId: 'k1',
  navn: 'For sent',
  engangsbode: false,
  pris: 50,
  givet: '2026-10-11T13:00:00Z',
  ankeId: 'a1',
  afgoerelse: null,
  anket: true,
  afgoerelseAendret: false,
  baererId: null,
  annullering: null,
  gebyr: 0,
  afgjort: null,
  ankeGebyr: 37,
  ...over,
});

const medlem = (medlemId: string, erAdmin = false) => ({ medlemId, erAdmin });
const vundet = (afId = 'frederik') =>
  boede({ anket: false, afgoerelse: 'modtager_vandt', baererId: 'jonas', afgjort: { tid: '2026-10-11T15:00:00Z', afId, afNavn: 'Frederik' } });

describe('recording the group verdict', () => {
  it('is for anyone but the giver and the receiver, while the Anke is open', () => {
    expect(kanRegistrereAfgoerelse(boede(), medlem('frederik'), true)).toBe(true);
    expect(kanRegistrereAfgoerelse(boede(), medlem('jonas', true), true)).toBe(false);
    expect(kanRegistrereAfgoerelse(boede(), medlem('emil'), true)).toBe(false);
    expect(kanRegistrereAfgoerelse(vundet(), medlem('oliver'), true)).toBe(false);
  });

  it('is not possible once a newer Sæson started', () => {
    expect(kanRegistrereAfgoerelse(boede(), medlem('frederik'), false)).toBe(false);
  });

  it('tells the two involved that the group decides', () => {
    expect(partIAnken(boede(), medlem('jonas'))).toBe(true);
    expect(partIAnken(boede(), medlem('emil'))).toBe(true);
    expect(partIAnken(boede(), medlem('frederik'))).toBe(false);
    expect(partIAnken(vundet(), medlem('emil'))).toBe(false);
  });
});

describe('changing the verdict', () => {
  it('is for the one who recorded it or an Admin, in the latest Sæson', () => {
    expect(kanAendreAfgoerelse(vundet(), medlem('frederik'), true)).toBe(true);
    expect(kanAendreAfgoerelse(vundet(), medlem('mads', true), true)).toBe(true);
    expect(kanAendreAfgoerelse(vundet(), medlem('oliver'), true)).toBe(false);
    expect(kanAendreAfgoerelse(vundet(), medlem('frederik'), false)).toBe(false);
  });

  it('needs a verdict that still stands', () => {
    expect(kanAendreAfgoerelse(boede(), medlem('mads', true), true)).toBe(false);
    const annullering = { tid: '2026-10-11T16:00:00Z', afId: 'mads', afNavn: 'Mads', note: null };
    expect(kanAendreAfgoerelse({ ...vundet(), annullering }, medlem('mads', true), true)).toBe(false);
    const lukket = boede({ anket: false, afgoerelse: 'ikke_afgjort', afgjort: { tid: '2026-10-11T16:00:00Z', afId: null, afNavn: '' } });
    expect(kanAendreAfgoerelse(lukket, medlem('mads', true), true)).toBe(false);
  });
});

describe('the verdict sheet', () => {
  it('offers both verdicts with who pays, for the person looking', () => {
    expect(afgoerelseValg(boede(), { migId: 'frederik' })).toEqual([
      { afgoerelse: 'giver_vandt', titel: 'Bøden står ved magt', tekst: 'Emil betaler de 50 kr' },
      { afgoerelse: 'modtager_vandt', titel: 'Anken vinder', tekst: 'Bøden flyttes til Jonas' },
    ]);
    expect(afgoerelseValg(boede(), { migId: 'jonas' })[1]?.tekst).toBe('Bøden flyttes til dig');
    expect(afgoerelseValg(boede(), { migId: 'emil' })[0]?.tekst).toBe('Du betaler de 50 kr');
  });
});
