import { describe, expect, it } from 'vitest';
import type { Boede } from '../haendelse.ts';
import { kanAnnullereBoede } from './annuller.ts';

const boede = (over: Partial<Boede> = {}): Boede => ({
  id: 'b1',
  saesonId: 's1',
  batchId: 'batch',
  giverId: 'jonas',
  giverNavn: 'Jonas Holm',
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
  afgjort: null,
  ankeGebyr: null,
  ...over,
});

const giver = { medlemId: 'jonas', erAdmin: false };
const modtager = { medlemId: 'emil', erAdmin: false };
const anden = { medlemId: 'oliver', erAdmin: false };
const admin = { medlemId: 'frederik', erAdmin: true };
const annulleret = { tid: '2026-10-11T14:00:00Z', afId: 'jonas', afNavn: 'Jonas Holm', note: null };

describe('who can annul a Bøde', () => {
  it('lets the giver annul their own Bøde while it has never been appealed', () => {
    expect(kanAnnullereBoede(boede(), giver, true)).toBe(true);
    expect(kanAnnullereBoede(boede({ ankeId: 'a1', anket: true, baererId: null }), giver, true)).toBe(false);
    expect(kanAnnullereBoede(boede({ ankeId: 'a1', afgoerelse: 'giver_vandt' }), giver, true)).toBe(false);
  });

  it('never lets the receiver or anyone else annul it', () => {
    expect(kanAnnullereBoede(boede(), modtager, true)).toBe(false);
    expect(kanAnnullereBoede(boede(), anden, true)).toBe(false);
  });

  it('lets an Admin annul any Bøde, appealed or not', () => {
    expect(kanAnnullereBoede(boede(), admin, true)).toBe(true);
    expect(kanAnnullereBoede(boede({ ankeId: 'a1', anket: true, baererId: null }), admin, true)).toBe(true);
  });

  it('only in the latest Sæson, and never twice', () => {
    expect(kanAnnullereBoede(boede(), admin, false)).toBe(false);
    expect(kanAnnullereBoede(boede({ annullering: annulleret, baererId: null }), admin, true)).toBe(false);
  });
});
