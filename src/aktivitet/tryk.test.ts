import { describe, expect, it } from 'vitest';
import type { Gebyr } from './haendelse.ts';
import { trykPaaRaekke } from './tryk.ts';
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
