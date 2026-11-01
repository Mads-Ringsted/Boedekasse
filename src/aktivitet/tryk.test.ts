import { describe, expect, it } from 'vitest';
import type { Gebyr } from './haendelse.ts';
import { maaAnnullereGebyr, trykPaaRaekke } from './tryk.ts';
import type { Raekke } from './visning.ts';

const gebyr: Gebyr = { id: 'g1', art: 'anke', beloeb: 37, medlemId: 'emil', medlemNavn: 'Emil Bach', annullering: null };
const raekke = (over: Partial<Raekke> = {}): Raekke => ({
  ikon: { slags: 'avatar', navn: 'Emil Bach' },
  titel: 'Emil ankede For sent',
  linje: '',
  annulleret: false,
  ...over,
});

describe('trykPaaRaekke (what tapping a feed row opens)', () => {
  it('opens the Bøde detail for a Bøde row, even for an Admin when it has a Gebyr to annul', () => {
    expect(trykPaaRaekke(raekke({ boedeId: 'b1', annullerGebyr: gebyr }), true)).toEqual({ art: 'boede', boedeId: 'b1' });
  });

  it('opens Annullér gebyr for an Admin on a row with only a Gebyr to annul', () => {
    expect(trykPaaRaekke(raekke({ annullerGebyr: gebyr }), true)).toEqual({ art: 'gebyr', gebyr });
    expect(trykPaaRaekke(raekke({ annullerGebyr: gebyr }), false)).toBeNull();
  });

  it('follows a link, or does nothing', () => {
    expect(trykPaaRaekke(raekke({ link: '/konkurrencer/k1' }), false)).toEqual({ art: 'link', link: '/konkurrencer/k1' });
    expect(trykPaaRaekke(raekke(), true)).toBeNull();
  });
});

describe('maaAnnullereGebyr (who may annul a Gebyr from its row)', () => {
  const admin = { erAdmin: true, kanHaandterePenge: true };
  const kasserer = { erAdmin: false, kanHaandterePenge: true };
  const medlem = { erAdmin: false, kanHaandterePenge: false };

  it('lets an Admin or a Kasserer annul a late day', () => {
    expect(maaAnnullereGebyr('sen_betaling', admin)).toBe(true);
    expect(maaAnnullereGebyr('sen_betaling', kasserer)).toBe(true);
    expect(maaAnnullereGebyr('sen_betaling', medlem)).toBe(false);
  });

  it('keeps every other kind Admin-only', () => {
    expect(maaAnnullereGebyr('catch_up', admin)).toBe(true);
    expect(maaAnnullereGebyr('catch_up', kasserer)).toBe(false);
    expect(maaAnnullereGebyr('oprettelse', kasserer)).toBe(false);
  });
});
