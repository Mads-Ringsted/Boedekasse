import { describe, expect, it } from 'vitest';
import type { Haendelse } from '../haendelse.ts';
import { beskrivRaekke } from '../raekke.ts';

const KASPER = 'kasper';
const FREDERIK = 'frederik';
const ctx = { migId: 'mig' };

function haendelse(over: Partial<Haendelse> = {}): Haendelse {
  return {
    id: 1,
    tid: '2026-10-11T17:25:00Z',
    art: 'indbetaling',
    aktoerId: FREDERIK,
    aktoerNavn: 'Frederik Lund',
    modtagerId: KASPER,
    modtagerNavn: 'Kasper Nørgaard',
    batchId: null,
    refTabel: 'indbetaling',
    refId: 'i1',
    data: { navn: 'Kasper Nørgaard', beloeb: 80, note: null },
    annullering: null,
    boeder: [],
    gebyrer: [],
    ...over,
  };
}

describe('an Indbetaling row', () => {
  it('says who paid and who registered it, with "+80 kr" in green', () => {
    expect(beskrivRaekke(haendelse(), ctx)).toMatchObject({
      titel: 'Kasper betalte ind',
      linje: 'Registreret af Frederik',
      beloeb: { tekst: '+80 kr', tone: 'groen' },
      ikon: { slags: 'avatar', navn: 'Kasper Nørgaard' },
      annulleret: false,
    });
  });

  it('says "Du" and "dig", and adds the note', () => {
    const r = beskrivRaekke(
      haendelse({ aktoerId: 'mig', modtagerId: 'mig', data: { navn: 'Mig', beloeb: 80, note: 'Kontant' } }),
      ctx,
    );
    expect(r).toMatchObject({ titel: 'Du betalte ind', linje: 'Registreret af dig · Kontant' });
  });

  it('stays struck through once annulled', () => {
    const r = beskrivRaekke(
      haendelse({ annullering: { tid: '2026-10-11T18:00:00Z', afId: FREDERIK, afNavn: 'Frederik Lund', note: 'Fejl' } }),
      ctx,
    );
    expect(r).toMatchObject({ annulleret: true, linje: 'Registreret af Frederik · annulleret af Frederik · Fejl' });
  });
});

describe('the row for annulling an Indbetaling', () => {
  it('says who annulled whose Indbetaling, the amount and the note', () => {
    const r = beskrivRaekke(
      haendelse({
        art: 'indbetaling_annulleret',
        refTabel: null,
        refId: null,
        data: { indbetaling_id: 'i1', navn: 'Kasper Nørgaard', beloeb: 80, note: 'Forkert person' },
      }),
      ctx,
    );
    expect(r).toMatchObject({
      titel: 'Frederik annullerede en indbetaling',
      linje: 'Fra Kasper · 80 kr · Forkert person',
      annulleret: false,
    });
    expect(r?.beloeb).toBeUndefined();
  });
});

describe('a confirmed Betalingsmelding row', () => {
  const bekraeftet = (over: Partial<Haendelse> = {}) =>
    haendelse({ art: 'betaling_bekraeftet', data: { navn: 'Kasper Nørgaard', beloeb: 85 }, ...over });

  it('says who paid and who confirmed it, with "+85 kr" in green', () => {
    expect(beskrivRaekke(bekraeftet(), ctx)).toMatchObject({
      titel: 'Kasper betalte ind',
      linje: 'Bekræftet af Frederik',
      beloeb: { tekst: '+85 kr', tone: 'groen' },
      ikon: { slags: 'avatar', navn: 'Kasper Nørgaard' },
      annulleret: false,
    });
  });

  it('stays struck through once its Indbetaling is annulled', () => {
    const r = beskrivRaekke(
      bekraeftet({ annullering: { tid: '2026-10-11T18:00:00Z', afId: FREDERIK, afNavn: 'Frederik Lund', note: null } }),
      ctx,
    );
    expect(r).toMatchObject({ annulleret: true });
  });
});

describe('a rejected Betalingsmelding row', () => {
  it('says who rejected whose payment and the amount', () => {
    const r = beskrivRaekke(
      haendelse({ art: 'betaling_afvist', refTabel: null, refId: null, data: { navn: 'Kasper Nørgaard', beloeb: 50 } }),
      ctx,
    );
    expect(r).toMatchObject({
      titel: 'Frederik afviste en betaling',
      linje: 'Fra Kasper · 50 kr',
      ikon: { slags: 'avatar', navn: 'Frederik Lund' },
      annulleret: false,
    });
    expect(r?.beloeb).toBeUndefined();
  });
});
