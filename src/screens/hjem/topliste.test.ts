import { describe, expect, it } from 'vitest';
import { minStatus, opdelTopliste, type ToplisteRad } from './topliste.ts';

const rad = (navn: string, boederIAlt: number, plads: number): ToplisteRad => ({
  medlemId: navn.toLowerCase(),
  navn,
  boederIAlt,
  indbetalt: 0,
  plads,
});

describe('opdelTopliste (the Hjem podium and the rows below it)', () => {
  it('puts the top 3 on the podium as 2nd, 1st, 3rd and the rest in rows', () => {
    const { podie, resten, tom } = opdelTopliste([
      rad('Lucas', 130, 5),
      rad('Oliver', 310, 1),
      rad('Emil', 205, 3),
      rad('Jonas', 200, 4),
      rad('Kasper', 210, 2),
    ]);
    expect(podie.map((p) => [p.navn, p.trin])).toEqual([
      ['Kasper', 2],
      ['Oliver', 1],
      ['Emil', 3],
    ]);
    expect(resten.map((r) => r.navn)).toEqual(['Jonas', 'Lucas']);
    expect(tom).toBe(false);
  });

  it('orders a shared place by name (Danish order), and the podium follows that order', () => {
    const { podie, resten } = opdelTopliste([
      rad('Åse', 60, 2),
      rad('Bo', 60, 2),
      rad('Anna', 100, 1),
      rad('Ølle', 60, 2),
    ]);
    expect(podie.map((p) => [p.navn, p.trin, p.plads])).toEqual([
      ['Bo', 2, 2],
      ['Anna', 1, 1],
      ['Ølle', 3, 2],
    ]);
    expect(resten.map((r) => r.navn)).toEqual(['Åse']);
  });

  it('builds a short podium in a small box', () => {
    const { podie, resten } = opdelTopliste([rad('Bo', 10, 2), rad('Anna', 50, 1)]);
    expect(podie.map((p) => p.navn)).toEqual(['Bo', 'Anna']);
    expect(resten).toEqual([]);
  });

  it('is empty until someone has Bøder this Sæson', () => {
    expect(opdelTopliste([rad('Anna', 0, 1), rad('Bo', 0, 1)]).tom).toBe(true);
    expect(opdelTopliste([]).tom).toBe(true);
  });
});

describe('minStatus ("Du mangler at betale" or "Du har til gode")', () => {
  it('a positive Saldo is what you owe, with Betal', () => {
    expect(minStatus(6)).toEqual({ art: 'mangler', beloeb: 6, kanBetale: true });
  });

  it('a negative Saldo is Til gode, without Betal', () => {
    expect(minStatus(-14)).toEqual({ art: 'tilGode', beloeb: 14, kanBetale: false });
  });

  it('a zero Saldo owes nothing and has nothing to pay', () => {
    expect(minStatus(0)).toEqual({ art: 'mangler', beloeb: 0, kanBetale: false });
  });
});
