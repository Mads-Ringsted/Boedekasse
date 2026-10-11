import { describe, expect, it } from 'vitest';
import type { Konkurrence } from '../../konkurrence/konkurrence.ts';
import type { Haendelse } from '../haendelse.ts';
import { beskrivRaekke } from '../raekke.ts';

const MIG = 'mads';

function bowling(over: Partial<Konkurrence> = {}): Konkurrence {
  return {
    id: 'k1',
    saesonId: 's1',
    titel: 'Bowling',
    dato: '2026-10-10',
    oprettetAf: 'frederik',
    oprettetAfNavn: 'Frederik Lund',
    rettetAf: null,
    rettetAfNavn: null,
    annullering: null,
    antalPlaceret: 5,
    antalFravaerende: 3,
    antalGebyrer: 8,
    total: 260,
    resultat: [
      { medlemId: 'frederik', navn: 'Frederik Lund', loggetInd: true, plads: 1, beloeb: 0 },
      { medlemId: 'kasper', navn: 'Kasper Nørgaard', loggetInd: true, plads: 2, beloeb: 10 },
      { medlemId: 'jonas', navn: 'Jonas Holm', loggetInd: true, plads: 3, beloeb: 25 },
      { medlemId: 'lucas', navn: 'Lucas Berg', loggetInd: true, plads: null, beloeb: 50 },
    ],
    ...over,
  };
}

function haendelse(over: Partial<Haendelse> = {}): Haendelse {
  return {
    id: 1,
    tid: '2026-10-10T18:00:00Z',
    art: 'konkurrence_registreret',
    aktoerId: 'frederik',
    aktoerNavn: 'Frederik Lund',
    modtagerId: null,
    modtagerNavn: null,
    batchId: null,
    refTabel: 'konkurrence',
    refId: 'k1',
    data: { titel: 'Bowling' },
    annullering: null,
    boeder: [],
    gebyrer: [],
    konkurrence: bowling(),
    ...over,
  };
}

describe('a Konkurrence row', () => {
  it('is one grouped row with the winner, the Gebyr count and the total', () => {
    expect(beskrivRaekke(haendelse(), { migId: MIG })).toMatchObject({
      ikon: { slags: 'symbol', symbol: 'trofae' },
      titel: 'Konkurrence: Bowling',
      linje: 'Frederik vandt · 8 gebyrer',
      beloeb: { tekst: '260 kr' },
      link: '/konkurrencer/k1',
      annulleret: false,
    });
  });

  it('names every winner of a tie, and says Du for you', () => {
    const k = bowling({
      resultat: [
        { medlemId: MIG, navn: 'Mads Ringsted', loggetInd: true, plads: 1, beloeb: 0 },
        { medlemId: 'emil', navn: 'Emil Bach', loggetInd: true, plads: 1, beloeb: 0 },
      ],
    });
    expect(beskrivRaekke(haendelse({ konkurrence: k }), { migId: MIG })?.linje).toBe('Du og Emil vandt · 8 gebyrer');
  });

  it('is tagged "Rettet af X" after a correction', () => {
    const r = beskrivRaekke(
      haendelse({ konkurrence: bowling({ rettetAf: 'mads', rettetAfNavn: 'Mads Ringsted' }) }),
      { migId: 'jonas' },
    );
    expect(r?.tag).toEqual({ tekst: 'Rettet af Mads', tone: 'blaa' });
  });

  it('in a Medlem\'s history shows their place and Gebyr', () => {
    expect(beskrivRaekke(haendelse(), { migId: MIG, profilId: 'jonas' })).toMatchObject({
      titel: 'Bowling',
      linje: 'Konkurrence · 3. plads',
      beloeb: { tekst: '25 kr' },
    });
    expect(beskrivRaekke(haendelse(), { migId: MIG, profilId: 'lucas' })).toMatchObject({
      linje: 'Konkurrence · Fraværende',
      beloeb: { tekst: '50 kr' },
    });
  });

  it('stays struck through once annulled', () => {
    const annullering = { tid: '2026-10-11T08:00:00Z', afId: 'frederik', afNavn: 'Frederik Lund', note: null };
    const r = beskrivRaekke(haendelse({ annullering, konkurrence: bowling({ annullering }) }), { migId: MIG });
    expect(r).toMatchObject({ annulleret: true, tag: { tekst: 'Annulleret' } });
  });
});

describe('a Konkurrence annulled row', () => {
  it('says who annulled which Konkurrence, and opens it', () => {
    const r = beskrivRaekke(
      haendelse({
        art: 'konkurrence_annulleret',
        refTabel: null,
        refId: null,
        konkurrence: null,
        data: { titel: 'Bowling', beloeb: 260, konkurrence_id: 'k1' },
      }),
      { migId: MIG },
    );
    expect(r).toMatchObject({
      titel: 'Frederik annullerede konkurrencen Bowling',
      linje: 'Konkurrence · 260 kr',
      link: '/konkurrencer/k1',
      annulleret: false,
    });
  });
});
