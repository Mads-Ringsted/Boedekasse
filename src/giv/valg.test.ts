import { describe, expect, it } from 'vitest';
import {
  faellesAntal,
  givLinjer,
  minusAlle,
  minusPerson,
  modtagereAf,
  nytValg,
  opsummer,
  plusAlle,
  plusPerson,
  skiftPerson,
  vaelgAlle,
  type Regler,
} from './valg.ts';

const kategorier = [
  { id: 'for-sent', navn: 'For sent', pris: 50 },
  { id: 'hygge', navn: 'Hygge i stedet for træning', pris: 40 },
  { id: 'spildt', navn: 'Spildt drikke', pris: 20 },
];

describe('Giv bøder selection (people × Bødekategorier × counts)', () => {
  it('a Bødekategori added in Hvad goes to everyone picked', () => {
    let valg = nytValg();
    valg = skiftPerson(valg, 'jonas');
    valg = skiftPerson(valg, 'emil');
    valg = plusAlle(valg, 'for-sent');

    const sum = opsummer(valg, kategorier);
    expect(sum.antal).toBe(2);
    expect(sum.beloeb).toBe(100);
    expect(sum.hver).toEqual({ antal: 1, beloeb: 50 });
    expect(givLinjer(valg)).toEqual([
      { modtager_id: 'jonas', bodekategori_id: 'for-sent', antal: 1 },
      { modtager_id: 'emil', bodekategori_id: 'for-sent', antal: 1 },
    ]);
  });

  it('"Tilpas pr. person": a whole evening with different Bøder per person (step 3 mock)', () => {
    let valg = vaelgAlle(nytValg(), ['jonas', 'emil']);
    valg = plusAlle(valg, 'for-sent');
    valg = plusPerson(valg, 'jonas', 'for-sent');
    valg = plusPerson(valg, 'jonas', 'hygge');
    valg = plusPerson(valg, 'emil', 'spildt');

    const sum = opsummer(valg, kategorier);
    expect(sum.antal).toBe(5);
    expect(sum.beloeb).toBe(210);
    expect(sum.hver).toBeNull();
    expect(sum.personer.map((p) => [p.id, p.beloeb, p.linjer.map((l) => `${l.antal}× ${l.navn}`)])).toEqual([
      ['jonas', 140, ['2× For sent', '1× Hygge i stedet for træning']],
      ['emil', 70, ['1× For sent', '1× Spildt drikke']],
    ]);
  });

  it('"−" takes one away from everyone; at 0 the Bødekategori is gone from the submit', () => {
    let valg = vaelgAlle(nytValg(), ['jonas', 'emil']);
    valg = plusAlle(plusAlle(valg, 'for-sent'), 'for-sent');
    valg = minusAlle(valg, 'for-sent');
    expect(faellesAntal(valg, 'for-sent')).toBe(1);
    expect(opsummer(valg, kategorier).hver).toEqual({ antal: 1, beloeb: 50 });

    valg = minusAlle(valg, 'for-sent');
    expect(faellesAntal(valg, 'for-sent')).toBe(0);
    expect(givLinjer(valg)).toEqual([]);
    expect(minusAlle(valg, 'for-sent')).toEqual(valg);
  });

  it('a count never goes below 0 for one person', () => {
    const valg = minusPerson(vaelgAlle(nytValg(), ['jonas']), 'jonas', 'for-sent');
    expect(opsummer(valg, kategorier).antal).toBe(0);
  });

  it('un-picking a person drops their Bøder; picking someone later gives them the shared ones', () => {
    let valg = vaelgAlle(nytValg(), ['jonas', 'emil']);
    valg = plusAlle(valg, 'spildt');
    valg = plusPerson(valg, 'emil', 'hygge');
    valg = skiftPerson(valg, 'emil');
    valg = skiftPerson(valg, 'kasper');

    expect(givLinjer(valg)).toEqual([
      { modtager_id: 'jonas', bodekategori_id: 'spildt', antal: 1 },
      { modtager_id: 'kasper', bodekategori_id: 'spildt', antal: 1 },
    ]);
  });

  it('a picked person with no Bøder still shows in step 3 but is left out of the submit', () => {
    let valg = vaelgAlle(nytValg(), ['jonas', 'emil']);
    valg = plusPerson(valg, 'jonas', 'for-sent');
    const sum = opsummer(valg, kategorier);
    expect(sum.personer.map((p) => [p.id, p.antal])).toEqual([
      ['jonas', 1],
      ['emil', 0],
    ]);
    expect(givLinjer(valg)).toHaveLength(1);
  });

  it('"Giv denne bøde" starts with that Bødekategori, which goes to whoever is picked', () => {
    let valg = nytValg({ kategoriId: 'hygge' });
    expect(opsummer(valg, kategorier).antal).toBe(0);
    valg = skiftPerson(valg, 'oliver');
    expect(givLinjer(valg)).toEqual([{ modtager_id: 'oliver', bodekategori_id: 'hygge', antal: 1 }]);
  });

  it('"Giv bøde" on a profile starts with that person picked', () => {
    expect(nytValg({ personer: ['emil'] }).personer).toEqual(['emil']);
  });

  it('a person who may not get a Bødekategori is skipped for it (Frikøb)', () => {
    const frikob: Regler = { kanFaa: (p, k) => !(p === 'oliver' && k === 'for-sent') };
    let valg = vaelgAlle(nytValg(), ['jonas', 'oliver'], frikob);
    valg = plusAlle(valg, 'for-sent', frikob);
    valg = plusAlle(valg, 'spildt', frikob);
    valg = plusPerson(valg, 'oliver', 'for-sent', frikob);

    expect(modtagereAf(valg, 'for-sent', frikob)).toEqual(['jonas']);
    expect(faellesAntal(valg, 'for-sent')).toBe(1);
    const sum = opsummer(valg, kategorier);
    expect(sum.antal).toBe(3);
    expect(sum.beloeb).toBe(90);
    expect(sum.hver).toBeNull();
  });
});
