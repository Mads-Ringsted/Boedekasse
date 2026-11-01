import { describe, expect, it } from 'vitest';
import type { Haendelse } from '../haendelse.ts';
import { beskrivRaekke } from '../raekke.ts';

const ctx = { migId: 'mig' };

function catchUp(over: Partial<Haendelse> = {}): Haendelse {
  return {
    id: 1,
    tid: '2026-11-01T00:00:00Z',
    art: 'catch_up',
    aktoerId: null,
    aktoerNavn: null,
    modtagerId: 'emil',
    modtagerNavn: 'Emil Bach',
    batchId: null,
    refTabel: 'gebyr',
    refId: 'g1',
    data: { maaned: '2026-10-01', beloeb: 50, total: 120 },
    annullering: null,
    boeder: [],
    gebyrer: [],
    ...over,
  };
}

describe('a Catch-up row', () => {
  it('names who paid, for which month, their Sæson total and the amount', () => {
    expect(beskrivRaekke(catchUp(), ctx)).toMatchObject({
      titel: 'Emil fik catch-up for oktober',
      linje: 'Blandt de laveste i sæsonen · 120 kr i alt',
      beloeb: { tekst: '50 kr' },
      annulleret: false,
    });
  });

  it('says "Du" when it is your own', () => {
    expect(beskrivRaekke(catchUp({ modtagerId: 'mig' }), ctx)?.titel).toBe('Du fik catch-up for oktober');
  });

  it('lets an Admin annul the Gebyr from the row', () => {
    expect(beskrivRaekke(catchUp(), ctx)?.annullerGebyr).toEqual({
      id: 'g1',
      art: 'catch_up',
      beloeb: 50,
      medlemId: 'emil',
      medlemNavn: 'Emil Bach',
      annullering: null,
    });
  });

  it('is struck through, with nothing left to annul, once annulled', () => {
    const r = beskrivRaekke(
      catchUp({ annullering: { tid: '2026-11-02T10:00:00Z', afId: 'frederik', afNavn: 'Frederik Lund', note: null } }),
      ctx,
    );
    expect(r).toMatchObject({ annulleret: true, linje: 'Blandt de laveste i sæsonen · 120 kr i alt · annulleret af Frederik' });
    expect(r?.annullerGebyr).toBeUndefined();
  });
});

describe('a Gebyr annulment row', () => {
  it('names a Catch-up as the kind', () => {
    const r = beskrivRaekke(
      catchUp({
        art: 'gebyr_annulleret',
        aktoerId: 'frederik',
        aktoerNavn: 'Frederik Lund',
        refTabel: null,
        refId: null,
        data: { gebyr_id: 'g1', art: 'catch_up', navn: null, beloeb: 50, note: null },
      }),
      ctx,
    );
    expect(r?.linje).toBe('Catch-up · 50 kr');
  });
});
