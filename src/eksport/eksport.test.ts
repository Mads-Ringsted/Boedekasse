import { describe, expect, it } from 'vitest';
import { eksportCsv, eksportFilnavn, type EksportRaekke } from './eksport.ts';

const raekke = (r: Partial<EksportRaekke>): EksportRaekke => ({
  tid: '2026-03-02T09:00:00+00:00',
  art: 'bode',
  gebyr_art: null,
  medlem: 'Bo',
  af: 'Anna',
  hvad: 'For sent',
  beloeb: 50,
  anke: null,
  annulleret: null,
  annulleret_note: null,
  ...r,
});

/** The CSV's lines without the byte-order mark. */
const linjer = (csv: string) => csv.replace(/^﻿/, '').split('\r\n');

describe('eksportCsv (the CSV file an Admin downloads for one Sæson)', () => {
  it('starts with a UTF-8 byte-order mark and Danish headers, separated by semicolons', () => {
    const csv = eksportCsv([]);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(linjer(csv)[0]).toBe('Dato;Type;Medlem;Af;Hvad;Beløb (kr);Anke;Annulleret;Annulleringsnote');
  });

  it('writes one line per row in Danish time, with the kind in words and the amount as a plain number', () => {
    const csv = eksportCsv([
      raekke({ tid: '2026-03-02T09:00:00+00:00' }),
      raekke({ tid: '2026-07-01T21:30:00+00:00', art: 'engangsbode', medlem: 'Carl', af: 'Bo', hvad: 'Kom i klipklapper', beloeb: 1250 }),
      raekke({ art: 'gebyr', gebyr_art: 'oprettelse', medlem: 'Anna', af: null, beloeb: 25 }),
      raekke({ art: 'gebyr', gebyr_art: 'frikob', medlem: 'Bo', af: null, beloeb: 300 }),
      raekke({ art: 'indbetaling', medlem: 'Bo', af: 'Anna', hvad: null, beloeb: 100 }),
      raekke({ art: 'haevning', medlem: null, af: 'Anna', hvad: 'Bowling', beloeb: 40 }),
    ]);
    expect(linjer(csv).slice(1)).toEqual([
      '2026-03-02 10:00;Bøde;Bo;Anna;For sent;50;;;',
      '2026-07-01 23:30;Engangsbøde;Carl;Bo;Kom i klipklapper;1250;;;',
      '2026-03-02 10:00;Gebyr: ny bødekategori;Anna;;For sent;25;;;',
      '2026-03-02 10:00;Gebyr: frikøb;Bo;;For sent;300;;;',
      '2026-03-02 10:00;Indbetaling;Bo;Anna;;100;;;',
      '2026-03-02 10:00;Hævning;;Anna;Bowling;40;;;',
    ]);
  });

  it('marks an annulled row with the date it was annulled and its note', () => {
    const csv = eksportCsv([
      raekke({ art: 'indbetaling', annulleret: '2026-03-05T12:00:00+00:00', annulleret_note: 'Forkert beløb' }),
    ]);
    expect(linjer(csv)[1]).toBe('2026-03-02 10:00;Indbetaling;Bo;Anna;For sent;50;;2026-03-05 13:00;Forkert beløb');
  });

  it('shows how a Bøde\'s Anke ended', () => {
    const anke = (a: string | null) => linjer(eksportCsv([raekke({ anke: a })]))[1].split(';')[6];
    expect([anke('afventer'), anke('modtager_vandt'), anke('giver_vandt'), anke('ikke_afgjort'), anke(null)]).toEqual([
      'Afventer',
      'Anke vundet',
      'Anke tabt',
      'Ikke afgjort',
      '',
    ]);
  });

  it('quotes text with semicolons, quotes or line breaks, so the columns stay put', () => {
    const csv = eksportCsv([raekke({ hvad: 'Øl; sodavand og "snacks"\nkl. 22' })]);
    expect(csv.replace(/^﻿/, '').split('\r\n')[1]).toBe(
      '2026-03-02 10:00;Bøde;Bo;Anna;"Øl; sodavand og ""snacks""\nkl. 22";50;;;',
    );
  });

  it('keeps text that looks like a formula from running in Excel', () => {
    const csv = eksportCsv([raekke({ hvad: '=HYPERLINK("x")', medlem: '+45 Bo' })]);
    const felter = linjer(csv)[1];
    expect(felter).toContain(`;'+45 Bo;`);
    expect(felter).toContain(`;"'=HYPERLINK(""x"")";`);
  });
});

describe('eksportFilnavn (the downloaded file\'s name)', () => {
  it('names the box and the Sæson, without characters a file name cannot hold', () => {
    expect(eksportFilnavn('FC Ølhunde', 'Sæson 2026')).toBe('FC Ølhunde - Sæson 2026.csv');
    expect(eksportFilnavn('A/B', 'Forår?')).toBe('A-B - Forår-.csv');
  });
});
