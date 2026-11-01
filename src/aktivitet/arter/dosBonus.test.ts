import { describe, expect, it } from 'vitest';
import type { Haendelse } from '../haendelse.ts';
import { beskrivRaekke } from '../raekke.ts';

const KASPER = 'kasper';
const aar = new Date().getFullYear();

function haendelse(over: Partial<Haendelse> = {}): Haendelse {
  return {
    id: 1,
    tid: `${aar}-10-31T01:10:00Z`,
    art: 'dos_bonus',
    aktoerId: null,
    aktoerNavn: null,
    modtagerId: KASPER,
    modtagerNavn: 'Kasper Nørgaard',
    batchId: null,
    refTabel: 'gebyr',
    refId: 'g1',
    data: { dag: `${aar}-10-30`, beloeb: 10, kategorier: ['For sent', 'Øl'] },
    annullering: null,
    boeder: [],
    gebyrer: [],
    ...over,
  };
}

describe('a Dos-bonus row', () => {
  it('names who pays, the Bødekategorier and the day, with the amount', () => {
    expect(beskrivRaekke(haendelse(), { migId: 'mig' })).toMatchObject({
      ikon: { slags: 'avatar', navn: 'Kasper Nørgaard' },
      titel: 'Kasper fik en Dos-bonus',
      tag: { tekst: 'Dos-bonus' },
      linje: 'For sent, Øl · dagen 30. okt',
      beloeb: { tekst: '10 kr' },
      annulleret: false,
    });
  });

  it('says "Du" in your own feed', () => {
    expect(beskrivRaekke(haendelse(), { migId: KASPER })?.titel).toBe('Du fik en Dos-bonus');
  });

  it('is struck through when its pair was broken', () => {
    const r = beskrivRaekke(
      haendelse({ annullering: { tid: `${aar}-10-31T09:00:00Z`, afId: 'anna', afNavn: 'Anna Holm', note: null } }),
      { migId: 'mig' },
    );
    expect(r).toMatchObject({ annulleret: true, linje: 'For sent, Øl · dagen 30. okt · annulleret af Anna' });
  });
});
