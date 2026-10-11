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
