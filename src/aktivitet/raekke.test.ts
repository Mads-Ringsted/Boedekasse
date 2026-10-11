import { describe, expect, it } from 'vitest';
import type { Boede, Haendelse } from './haendelse.ts';
import { beskrivRaekke } from './raekke.ts';

const JONAS = 'jonas';
const EMIL = 'emil';
const MIG = 'mig';
const ctx = { migId: MIG };

function boede(over: Partial<Boede> = {}): Boede {
  return {
    id: 'b1',
    batchId: 'batch',
    giverId: JONAS,
    giverNavn: 'Jonas Holm',
    modtagerId: EMIL,
    modtagerNavn: 'Emil Bach',
    bodekategoriId: 'k1',
    navn: 'For sent',
    engangsbode: false,
    pris: 50,
    givet: '2026-10-11T17:25:00Z',
    ankeId: null,
    afgoerelse: null,
    anket: false,
    afgoerelseAendret: false,
    baererId: EMIL,
    annullering: null,
    gebyr: 0,
    ...over,
  };
}

function haendelse(over: Partial<Haendelse> = {}): Haendelse {
  return {
    id: 1,
    tid: '2026-10-11T17:25:00Z',
    art: 'boeder_givet',
    aktoerId: JONAS,
    aktoerNavn: 'Jonas Holm',
    modtagerId: EMIL,
    modtagerNavn: 'Emil Bach',
    batchId: 'batch',
    refTabel: null,
    refId: null,
    data: {},
    annullering: null,
    boeder: [boede()],
    gebyrer: [],
    ...over,
  };
}

describe('a Giv batch row', () => {
  it('shows one Bøde with its name and amount, and opens it', () => {
    const r = beskrivRaekke(haendelse(), ctx);
    expect(r).toMatchObject({
      titel: 'Jonas gav Emil en bøde',
      linje: 'For sent',
      beloeb: { tekst: '50 kr' },
      boedeId: 'b1',
      annulleret: false,
      ikon: { slags: 'avatar', navn: 'Emil Bach' },
    });
    expect(r?.boeder).toBeUndefined();
  });

  it('sums several Bøder into one row that expands to list them', () => {
    const r = beskrivRaekke(
      haendelse({
        boeder: [
          boede({ id: 'b1' }),
          boede({ id: 'b2', navn: 'Spildt drikke', pris: 20 }),
          boede({ id: 'b3' }),
        ],
      }),
      ctx,
    );
    expect(r).toMatchObject({
      titel: 'Jonas gav Emil 3 bøder',
      linje: '2× For sent, Spildt drikke',
      beloeb: { tekst: '120 kr' },
    });
    expect(r?.boedeId).toBeUndefined();
    expect(r?.boeder?.map((b) => [b.id, b.navn, b.beloeb])).toEqual([
      ['b1', 'For sent', '50 kr'],
      ['b2', 'Spildt drikke', '20 kr'],
      ['b3', 'For sent', '50 kr'],
    ]);
  });

  it('calls you "Du" and "dig"', () => {
    expect(beskrivRaekke(haendelse({ aktoerId: MIG }), ctx)?.titel).toBe('Du gav Emil en bøde');
    expect(beskrivRaekke(haendelse({ modtagerId: MIG }), ctx)?.titel).toBe('Jonas gav dig en bøde');
  });

  it('shows an Engangsbøde with its reason and the Gebyr under the amount', () => {
    const r = beskrivRaekke(
      haendelse({ boeder: [boede({ engangsbode: true, navn: 'Kom for sent til bryllup', pris: 100, gebyr: 10 })] }),
      ctx,
    );
    expect(r).toMatchObject({
      titel: 'Jonas gav Emil en engangsbøde',
      linje: 'Kom for sent til bryllup',
      beloeb: { tekst: '100 kr' },
      gebyr: '+10 kr gebyr',
    });
  });

  it('tags one Bøde with its status', () => {
    const tag = (over: Partial<Boede>) => beskrivRaekke(haendelse({ boeder: [boede(over)] }), ctx)?.tag;
    expect(tag({ anket: true, ankeId: 'a' })).toEqual({ tekst: 'Anket', tone: 'advarsel' });
    expect(tag({ ankeId: 'a', afgoerelse: 'modtager_vandt' })?.tekst).toBe('Anke vundet');
    expect(tag({ ankeId: 'a', afgoerelse: 'giver_vandt' })?.tekst).toBe('Anke tabt');
    expect(tag({ ankeId: 'a', afgoerelse: 'giver_vandt', afgoerelseAendret: true })?.tekst).toBe('Afgørelse ændret');
    expect(tag({})).toBeUndefined();
  });

  const annulleret = { tid: '2026-10-11T17:30:00Z', afId: 'kasper', afNavn: 'Kasper Nørgaard', note: null };

  it('strikes an annulled Bøde through, saying who annulled it', () => {
    const r = beskrivRaekke(haendelse({ boeder: [boede({ annullering: annulleret })] }), ctx);
    expect(r).toMatchObject({
      tag: { tekst: 'Annulleret' },
      linje: 'For sent · annulleret af Kasper',
      beloeb: { tekst: '50 kr' },
      annulleret: true,
    });
  });

  it('leaves annulled Bøder out of a batch total, struck in the list', () => {
    const r = beskrivRaekke(
      haendelse({
        boeder: [
          boede({ id: 'b1' }),
          boede({ id: 'b2', pris: 20, engangsbode: true, gebyr: 10, annullering: annulleret }),
        ],
      }),
      ctx,
    );
    expect(r).toMatchObject({ beloeb: { tekst: '50 kr' }, annulleret: false });
    expect(r?.gebyr).toBeUndefined();
    expect(r?.boeder?.map((b) => [b.annulleret, b.tag?.tekst])).toEqual([
      [false, undefined],
      [true, 'Annulleret'],
    ]);
  });

  it('is left out when its Bøder are gone', () => {
    expect(beskrivRaekke(haendelse({ boeder: [] }), ctx)).toBeNull();
  });
});

const andet = (over: Partial<Haendelse>) =>
  haendelse({ batchId: null, modtagerId: null, modtagerNavn: null, boeder: [], ...over });

describe('every kind of row', () => {
  it('leaves out a kind the app does not know yet', () => {
    expect(beskrivRaekke(andet({ art: 'noget_nyt' }), ctx)).toBeNull();
  });

  it('strikes an entry through when the row it is about was annulled, with who and the note', () => {
    const haevet = () => ({ ikon: { slags: 'symbol', symbol: 'kategori' }, titel: 'Hævet', linje: 'Julefrokost', beloeb: { tekst: '300 kr' }, annulleret: false }) as const;
    const r = beskrivRaekke(
      andet({
        art: 'haevet',
        annullering: { tid: '2026-10-11T18:00:00Z', afId: 'kasper', afNavn: 'Kasper Nørgaard', note: 'Forkert beløb' },
      }),
      ctx,
      { haevet },
    );
    expect(r).toMatchObject({
      tag: { tekst: 'Annulleret', tone: 'graa' },
      linje: 'Julefrokost · annulleret af Kasper · Forkert beløb',
      annulleret: true,
    });
  });
});

describe('Bødekategori rows', () => {
  const kategori = (art: string, data: Haendelse['data'], over: Partial<Haendelse> = {}) =>
    beskrivRaekke(andet({ art, data, refTabel: 'bodekategori', refId: 'k1', ...over }), ctx);
  const gebyr = (over: Partial<Haendelse['gebyrer'][number]> = {}) => ({
    id: 'g1', art: 'oprettelse', beloeb: 25, medlemId: JONAS, medlemNavn: 'Jonas Holm', annullering: null, ...over,
  });

  it('shows a created one with its price and its creation Gebyr', () => {
    expect(kategori('bodekategori_oprettet', { navn: 'For sent', pris: 50 }, { gebyrer: [gebyr()] })).toMatchObject({
      titel: 'Jonas oprettede For sent',
      linje: 'Ny bødekategori · 50 kr',
      gebyr: '+25 kr gebyr',
      ikon: { slags: 'symbol', symbol: 'kategori' },
    });
  });

  it('drops an annulled creation Gebyr', () => {
    const r = kategori('bodekategori_oprettet', { navn: 'For sent', pris: 50 }, {
      gebyrer: [gebyr({ annullering: { tid: 'x', afId: 'a', afNavn: 'Frederik', note: null } })],
    });
    expect(r?.gebyr).toBe('Gebyr annulleret');
  });

  it('shows a new price and an archived one', () => {
    expect(kategori('bodekategori_ompriset', { navn: 'For sent', gammel_pris: 50, ny_pris: 60 })).toMatchObject({
      titel: 'Jonas ændrede prisen på For sent',
      linje: '50 kr → 60 kr',
    });
    expect(kategori('bodekategori_arkiveret', { navn: 'For sent', pris: 50 })).toMatchObject({
      titel: 'Jonas arkiverede For sent',
      linje: 'Bødekategori · 50 kr',
    });
  });
});

describe('Medlem and Sæson rows', () => {
  it('shows a Medlem added by an Admin, and one who joined by code', () => {
    expect(
      beskrivRaekke(andet({ art: 'medlem_tilfoejet', modtagerId: EMIL, modtagerNavn: 'Emil Bach', data: { navn: 'Emil Bach' } }), ctx),
    ).toMatchObject({ titel: 'Jonas tilføjede Emil', linje: 'Nyt medlem', ikon: { slags: 'avatar', navn: 'Emil Bach' } });
    expect(beskrivRaekke(andet({ art: 'medlem_tilmeldt', data: { navn: 'Jonas Holm' } }), ctx)).toMatchObject({
      titel: 'Jonas kom med',
      linje: 'Med koden',
    });
  });

  it('shows the box created with its first Sæson, and a new Sæson', () => {
    expect(
      beskrivRaekke(andet({ art: 'bodekasse_oprettet', data: { bodekasse_navn: 'FC Ølhunde', saeson_navn: 'Sæson 2026' } }), ctx),
    ).toMatchObject({ titel: 'Jonas oprettede Bødekassen', linje: 'Sæson 2026 startede' });
    expect(beskrivRaekke(andet({ art: 'saeson_startet', data: { saeson_navn: 'Sæson 2027' } }), ctx)).toMatchObject({
      titel: 'Sæson 2027 startede',
      linje: 'Startet af Jonas',
    });
  });
});
