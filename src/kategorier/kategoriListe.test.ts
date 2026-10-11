import { describe, expect, it } from 'vitest';
import { kategoriListe, kanRette, kortDato, parsePris, type ListeKategori } from './kategoriListe.ts';

const k = (navn: string, pris: number, antal = 0, ofteBrugt = false, arkiveret = false): ListeKategori => ({
  id: navn,
  navn,
  pris,
  antal,
  ofteBrugt,
  arkiveret,
});

const kategorier = [
  k('Gult kort', 40, 4),
  k('For sent', 50, 34, true),
  k('Øl på banen', 30, 0),
  k('bandeord', 10, 15, true),
  k('Telefon ved bordet', 20, 21, true),
  k('Glemt udstyr', 25, 5),
  k('Arkiveret regel', 15, 0, false, true),
];

const navne = (liste: ListeKategori[]) => liste.map((x) => x.navn);

describe('kategoriListe (the Bødekategorier screen)', () => {
  it('sorted by Navn: the "Ofte brugt" ones on top, most used first, then the rest A–Å', () => {
    expect(navne(kategoriListe(kategorier, { soeg: '', sortering: 'navn' }).aktive)).toEqual([
      'For sent',
      'Telefon ved bordet',
      'bandeord',
      'Glemt udstyr',
      'Gult kort',
      'Øl på banen',
    ]);
  });

  it('sorted by Pris: cheapest first, whatever the use', () => {
    expect(navne(kategoriListe(kategorier, { soeg: '', sortering: 'pris' }).aktive)).toEqual([
      'bandeord',
      'Telefon ved bordet',
      'Glemt udstyr',
      'Øl på banen',
      'Gult kort',
      'For sent',
    ]);
  });

  it('search matches part of the name, ignoring case', () => {
    expect(navne(kategoriListe(kategorier, { soeg: ' GL ', sortering: 'navn' }).aktive)).toEqual(['Glemt udstyr']);
  });

  it('archived ones are kept apart, A–Å, and also follow the search', () => {
    const { arkiverede } = kategoriListe(kategorier, { soeg: '', sortering: 'navn' });
    expect(navne(arkiverede)).toEqual(['Arkiveret regel']);
    expect(kategoriListe(kategorier, { soeg: 'sent', sortering: 'navn' }).arkiverede).toEqual([]);
  });
});

describe('parsePris (the Pris field)', () => {
  it('reads whole kroner, with or without a thousands dot', () => {
    expect(parsePris('40')).toBe(40);
    expect(parsePris(' 1.250 ')).toBe(1250);
  });

  it('rejects 0, decimals, negatives and text', () => {
    for (const ugyldig of ['', '0', '12,50', '-5', 'fyrre', '00']) expect(parsePris(ugyldig)).toBeNull();
  });
});

describe('kanRette (who sees Redigér and Arkivér)', () => {
  it('the creator and Admins can; other Medlemmer cannot', () => {
    expect(kanRette({ oprettetAf: 'mig' }, { medlemId: 'mig', erAdmin: false })).toBe(true);
    expect(kanRette({ oprettetAf: 'anden' }, { medlemId: 'mig', erAdmin: true })).toBe(true);
    expect(kanRette({ oprettetAf: 'anden' }, { medlemId: 'mig', erAdmin: false })).toBe(false);
  });
});

describe('kortDato (Oprettet af … · 12. aug)', () => {
  const nu = new Date('2026-10-11T12:00:00Z');
  it('day and short month this year, in Copenhagen time', () => {
    expect(kortDato('2026-08-12T10:00:00Z', nu)).toBe('12. aug');
    expect(kortDato('2026-05-31T22:30:00Z', nu)).toBe('1. jun');
  });
  it('adds the year for an earlier year', () => {
    expect(kortDato('2025-12-03T10:00:00Z', nu)).toBe('3. dec 2025');
  });
});
