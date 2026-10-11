import { describe, expect, it } from 'vitest';
import type { Gebyr, Haendelse } from '../haendelse.ts';
import { beskrivRaekke } from '../raekke.ts';
import { annullerbartGebyr } from './faelles.ts';

const ctx = { migId: 'mig' };

function haendelse(over: Partial<Haendelse> = {}): Haendelse {
  return {
    id: 1,
    tid: '2026-10-11T17:25:00Z',
    art: 'bode_annulleret',
    aktoerId: 'frederik',
    aktoerNavn: 'Frederik Lund',
    modtagerId: 'emil',
    modtagerNavn: 'Emil Bach',
    batchId: null,
    refTabel: null,
    refId: null,
    data: {
      bode_id: 'b1',
      giver_id: 'jonas',
      giver_navn: 'Jonas Holm',
      navn: 'For sent',
      pris: 50,
      engangsbode: false,
      gebyr: 0,
      afgjort: null,
      aendret: null,
      ankeGebyr: null,
      note: null,
    },
    annullering: null,
    boeder: [],
    gebyrer: [],
    ...over,
  };
}

describe('a Bøde annulment row', () => {
  it('says who annulled whose Bøde to whom, with the name and amount, and opens the Bøde', () => {
    expect(beskrivRaekke(haendelse(), ctx)).toMatchObject({
      titel: "Frederik annullerede Jonas' bøde til Emil",
      linje: 'For sent · 50 kr',
      ikon: { slags: 'avatar', navn: 'Frederik Lund' },
      annulleret: false,
      boedeId: 'b1',
    });
  });

  it('reads naturally for your own and the giver’s own Bøde, and adds the note', () => {
    const data = { ...haendelse().data, giver_id: 'mig', giver_navn: 'Mads Ringsted', note: 'Forkert person' };
    expect(beskrivRaekke(haendelse({ data }), ctx)).toMatchObject({
      titel: 'Frederik annullerede din bøde til Emil',
      linje: 'For sent · 50 kr · Forkert person',
    });
    expect(beskrivRaekke(haendelse({ aktoerId: 'mig', aktoerNavn: 'Mads', data }), ctx)?.titel).toBe(
      'Du annullerede din bøde til Emil',
    );
    const egen = { ...haendelse().data, giver_id: 'frederik', giver_navn: 'Frederik Lund' };
    expect(beskrivRaekke(haendelse({ data: egen, modtagerId: 'mig' }), ctx)?.titel).toBe(
      'Frederik annullerede sin bøde til dig',
    );
    const emil = { ...haendelse().data, giver_id: 'emil', giver_navn: 'Emil Bach' };
    expect(beskrivRaekke(haendelse({ data: emil, modtagerId: 'jonas', modtagerNavn: 'Jonas' }), ctx)?.titel).toBe(
      'Frederik annullerede Emils bøde til Jonas',
    );
  });

  it('names an Engangsbøde and its annulled Gebyr', () => {
    const data = { ...haendelse().data, navn: 'Kom for sent til bryllup', pris: 100, engangsbode: true, gebyr: 10 };
    expect(beskrivRaekke(haendelse({ data }), ctx)).toMatchObject({
      titel: "Frederik annullerede Jonas' engangsbøde til Emil",
      linje: 'Kom for sent til bryllup · 100 kr',
      gebyr: 'Gebyr annulleret',
    });
  });
});

describe('a Gebyr annulment row', () => {
  const gebyrAnnulleret = (data: Haendelse['data'], over: Partial<Haendelse> = {}) =>
    haendelse({ art: 'gebyr_annulleret', modtagerId: 'oliver', modtagerNavn: 'Oliver Dam', data, ...over });

  it('says who annulled whose creation Gebyr, for which Bødekategori', () => {
    const h = gebyrAnnulleret({ gebyr_id: 'g1', art: 'oprettelse', navn: 'For sent', beloeb: 25, note: 'Vi giver den' });
    expect(beskrivRaekke(h, ctx)).toMatchObject({
      titel: 'Frederik annullerede Olivers gebyr',
      linje: 'Ny bødekategori: For sent · 25 kr · Vi giver den',
      annulleret: false,
    });
  });

  it('names an Anke Gebyr and says "dit" for your own', () => {
    const h = gebyrAnnulleret({ gebyr_id: 'g2', art: 'anke', navn: 'For sent', beloeb: 37, note: null }, { modtagerId: 'mig' });
    expect(beskrivRaekke(h, ctx)).toMatchObject({
      titel: 'Frederik annullerede dit gebyr',
      linje: 'Anke: For sent · 37 kr',
    });
  });
});

describe('the Gebyr an Admin can annul from a row', () => {
  const gebyr = (over: Partial<Gebyr>): Gebyr => ({
    id: 'g1',
    art: 'oprettelse',
    beloeb: 25,
    medlemId: 'oliver',
    medlemNavn: 'Oliver Dam',
    annullering: null,
    ...over,
  });

  it('is a creation or Anke Gebyr that still stands', () => {
    expect(annullerbartGebyr([gebyr({})])?.id).toBe('g1');
    expect(annullerbartGebyr([gebyr({ art: 'anke', id: 'g2' })])?.id).toBe('g2');
  });

  it('is never one that is annulled or goes with its cause', () => {
    const annulleret = { tid: '2026-10-11T14:00:00Z', afId: 'f', afNavn: 'Frederik', note: null };
    expect(annullerbartGebyr([gebyr({ annullering: annulleret })])).toBeUndefined();
    expect(annullerbartGebyr([gebyr({ art: 'engangsbode' }), gebyr({ art: 'frikob' })])).toBeUndefined();
    expect(annullerbartGebyr([])).toBeUndefined();
  });

  it('shows on a Bødekategori creation row', () => {
    const h = haendelse({
      art: 'bodekategori_oprettet',
      aktoerId: 'oliver',
      aktoerNavn: 'Oliver Dam',
      refTabel: 'bodekategori',
      refId: 'k1',
      data: { navn: 'For sent', pris: 50 },
      gebyrer: [gebyr({})],
    });
    expect(beskrivRaekke(h, ctx)?.annullerGebyr?.id).toBe('g1');
  });
});
