import { describe, expect, it } from 'vitest';
import type { Boede } from '../haendelse.ts';
import { detaljeRaekker, fraTil } from './detalje.ts';

const nu = new Date('2026-10-11T18:00:00Z');
const ctx = { migId: 'emil' };

const boede = (over: Partial<Boede> = {}): Boede => ({
  id: 'b1',
  saesonId: 's1',
  batchId: 'batch',
  giverId: 'frederik',
  giverNavn: 'Frederik Lund',
  modtagerId: 'emil',
  modtagerNavn: 'Emil Bach',
  bodekategoriId: 'k1',
  navn: 'For sent',
  engangsbode: false,
  pris: 50,
  givet: '2026-10-11T13:00:00Z',
  ankeId: null,
  afgoerelse: null,
  anket: false,
  afgoerelseAendret: false,
  baererId: 'emil',
  annullering: null,
  gebyr: 0,
  ...over,
});

describe('the Bøde detail sheet', () => {
  it('says who gave it to whom, and how long ago', () => {
    expect(fraTil(boede(), ctx, nu)).toBe('Fra Frederik til dig · 5 t');
    expect(fraTil(boede({ giverId: 'emil', modtagerId: 'jonas', modtagerNavn: 'Jonas Holm' }), ctx, nu)).toBe(
      'Fra dig til Jonas · 5 t',
    );
  });

  it('lists when it was given', () => {
    expect(detaljeRaekker(boede(), ctx, nu)).toEqual([{ label: 'Givet', vaerdi: 'I dag kl. 15.00' }]);
  });

  it('adds the Engangsbøde Gebyr, the Anke state, and who annulled it with the note', () => {
    const raekker = detaljeRaekker(
      boede({
        engangsbode: true,
        gebyr: 10,
        ankeId: 'a1',
        afgoerelse: 'modtager_vandt',
        annullering: { tid: '2026-10-11T17:00:00Z', afId: 'kasper', afNavn: 'Kasper Nørgaard', note: 'Det var vand' },
      }),
      ctx,
      nu,
    );
    expect(raekker.map((r) => [r.label, r.vaerdi])).toEqual([
      ['Givet', 'I dag kl. 15.00'],
      ['Gebyr', '10 kr · betales af Frederik'],
      ['Anke', 'Anken vandt'],
      ['Annulleret af', 'Kasper'],
      ['Note', 'Det var vand'],
    ]);
  });

  it('says an open Anke waits for the group', () => {
    expect(detaljeRaekker(boede({ ankeId: 'a1', anket: true }), ctx, nu)[1]).toEqual({
      label: 'Anke',
      vaerdi: 'Venter på gruppens afgørelse',
    });
  });

  it('shows how long the receiver can still appeal', () => {
    expect(detaljeRaekker(boede(), ctx, nu, { msTilbage: 19 * 3_600_000 })).toEqual([
      { label: 'Givet', vaerdi: 'I dag kl. 15.00' },
      { label: 'Kan ankes', vaerdi: '19 timer endnu' },
    ]);
  });

  it('ends an open Anke on an annulled Bøde as "Bøden annulleret"', () => {
    const annullering = { tid: '2026-10-11T17:00:00Z', afId: 'kasper', afNavn: 'Kasper Nørgaard', note: null };
    expect(detaljeRaekker(boede({ ankeId: 'a1', annullering }), ctx, nu)[1]).toEqual({
      label: 'Anke',
      vaerdi: 'Bøden annulleret',
    });
  });
});
