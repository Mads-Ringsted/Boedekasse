import { describe, expect, it } from 'vitest';
import type { Gebyr, Haendelse } from '../haendelse.ts';
import { beskrivRaekke } from '../raekke.ts';

const gebyr = (over: Partial<Gebyr> = {}): Gebyr => ({
  id: 'g1',
  art: 'anke',
  beloeb: 37,
  medlemId: 'emil',
  medlemNavn: 'Emil Bach',
  annullering: null,
  ...over,
});

function haendelse(over: Partial<Haendelse> = {}): Haendelse {
  return {
    id: 1,
    tid: '2026-10-11T17:25:00Z',
    art: 'anke_indgivet',
    aktoerId: 'emil',
    aktoerNavn: 'Emil Bach',
    modtagerId: 'frederik',
    modtagerNavn: 'Frederik Lund',
    batchId: null,
    refTabel: 'anke',
    refId: 'a1',
    data: { bode_id: 'b1', navn: 'For sent', pris: 50 },
    annullering: null,
    boeder: [],
    gebyrer: [gebyr()],
    ...over,
  };
}

describe('an Anke row', () => {
  it("says who appealed whose Bøde, with its name and price, the Gebyr, and opens the Bøde", () => {
    expect(beskrivRaekke(haendelse(), { migId: 'jonas' })).toMatchObject({
      titel: 'Emil ankede Frederiks bøde',
      linje: 'For sent · 50 kr',
      gebyr: '+37 kr gebyr',
      boedeId: 'b1',
      annulleret: false,
    });
  });

  it('reads "Du" and "din" for the people involved', () => {
    expect(beskrivRaekke(haendelse(), { migId: 'emil' })?.titel).toBe('Du ankede Frederiks bøde');
    expect(beskrivRaekke(haendelse(), { migId: 'frederik' })?.titel).toBe('Emil ankede din bøde');
  });

  it('offers Admins the Anke Gebyr to annul while it stands', () => {
    expect(beskrivRaekke(haendelse(), { migId: 'jonas' })?.annullerGebyr?.id).toBe('g1');
    const annulleret = { tid: '2026-10-11T18:00:00Z', afId: 'kasper', afNavn: 'Kasper', note: null };
    const raekke = beskrivRaekke(haendelse({ gebyrer: [gebyr({ annullering: annulleret })] }), { migId: 'jonas' });
    expect(raekke?.annullerGebyr).toBeUndefined();
    expect(raekke?.gebyr).toBe('Gebyr annulleret');
  });
});

describe('a verdict row', () => {
  const afgjort = (over: Partial<Haendelse> = {}) =>
    haendelse({
      id: 2,
      art: 'anke_afgjort',
      aktoerId: 'oliver',
      aktoerNavn: 'Oliver Dahl',
      data: {
        bode_id: 'b1',
        navn: 'For sent',
        pris: 50,
        afgoerelse: 'modtager_vandt',
        aendret: false,
        appellant_id: 'emil',
        appellant_navn: 'Emil Bach',
      },
      ...over,
    });

  it('says who won the Anke against whom, who decided, and opens the Bøde', () => {
    expect(beskrivRaekke(afgjort(), { migId: 'frederik' })).toMatchObject({
      ikon: { slags: 'avatar', navn: 'Emil Bach', egen: false },
      titel: 'Emil vandt anken mod dig',
      tag: { tekst: 'Anke vundet', tone: 'groen' },
      linje: 'For sent · 50 kr · afgjort af Oliver',
      boedeId: 'b1',
      annulleret: false,
    });
  });

  it('does not repeat the Anke Gebyr or offer it to annul (the Anke row does)', () => {
    const raekke = beskrivRaekke(afgjort(), { migId: 'jonas' });
    expect(raekke?.gebyr).toBeUndefined();
    expect(raekke?.annullerGebyr).toBeUndefined();
  });

  it('a lost Anke, changed: "tabte" and "ændret af"', () => {
    const data = { ...afgjort().data, afgoerelse: 'giver_vandt', aendret: true };
    expect(beskrivRaekke(afgjort({ data }), { migId: 'emil' })).toMatchObject({
      titel: 'Du tabte anken mod Frederik',
      tag: { tekst: 'Anke tabt', tone: 'roed' },
      linje: 'For sent · 50 kr · ændret af Oliver',
    });
    expect(beskrivRaekke(afgjort({ data }), { migId: 'oliver' })?.linje).toBe('For sent · 50 kr · ændret af dig');
  });
});
