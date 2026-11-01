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

function senBetaling(over: Partial<Haendelse> = {}): Haendelse {
  return catchUp({
    art: 'sen_betaling',
    refId: 'g2',
    data: { dag: '2026-02-06', beloeb: 25, skyldig: 100, betalt: 60 },
    ...over,
  });
}

describe('a Sen betaling row', () => {
  it('names who paid late, the day, what they owed and paid, and the amount', () => {
    expect(beskrivRaekke(senBetaling(), ctx)).toMatchObject({
      titel: 'Emil fik gebyr for sen betaling 6. februar',
      linje: 'Skyldte 100 kr fra sidste måned · 60 kr betalt',
      beloeb: { tekst: '25 kr' },
      annulleret: false,
    });
  });

  it('offers to annul that one day from the row', () => {
    expect(beskrivRaekke(senBetaling(), ctx)?.annullerGebyr).toEqual({
      id: 'g2',
      art: 'sen_betaling',
      beloeb: 25,
      medlemId: 'emil',
      medlemNavn: 'Emil Bach',
      annullering: null,
    });
  });

  it('names a late day as the kind when it is annulled', () => {
    const r = beskrivRaekke(
      senBetaling({
        art: 'gebyr_annulleret',
        aktoerId: 'frederik',
        aktoerNavn: 'Frederik Lund',
        refTabel: null,
        refId: null,
        data: { gebyr_id: 'g2', art: 'sen_betaling', navn: null, beloeb: 25, note: null },
      }),
      ctx,
    );
    expect(r?.linje).toBe('Sen betaling · 25 kr');
  });
});

function tilbagevendende(over: Partial<Haendelse> = {}): Haendelse {
  return catchUp({
    art: 'tilbagevendende',
    refId: 'g3',
    data: { navn: 'Kontingent', beloeb: 25, dato: '2026-03-02' },
    ...over,
  });
}

describe('a Tilbagevendende Gebyr row', () => {
  it('names who paid, the rule, the occurrence date and the amount', () => {
    expect(beskrivRaekke(tilbagevendende(), ctx)).toMatchObject({
      titel: 'Emil fik gebyret Kontingent',
      linje: 'Tilbagevendende gebyr · 2. marts',
      beloeb: { tekst: '25 kr' },
      annulleret: false,
    });
  });

  it('lets an Admin annul that one occurrence from the row', () => {
    expect(beskrivRaekke(tilbagevendende(), ctx)?.annullerGebyr).toEqual({
      id: 'g3',
      art: 'tilbagevendende',
      beloeb: 25,
      medlemId: 'emil',
      medlemNavn: 'Emil Bach',
      annullering: null,
    });
  });

  it('names the rule when it is annulled', () => {
    const r = beskrivRaekke(
      tilbagevendende({
        art: 'gebyr_annulleret',
        aktoerId: 'frederik',
        aktoerNavn: 'Frederik Lund',
        refTabel: null,
        refId: null,
        data: { gebyr_id: 'g3', art: 'tilbagevendende', navn: 'Kontingent', beloeb: 25, note: null },
      }),
      ctx,
    );
    expect(r?.linje).toBe('Tilbagevendende: Kontingent · 25 kr');
  });
});
