import { describe, expect, it } from 'vitest';
import { kortNavne, modtagerListe } from './navne.ts';

describe('kortNavne (names on the Giv bøder tiles)', () => {
  it('uses the first name', () => {
    expect(kortNavne(['Jonas Holm', 'Emil Bach'])).toEqual(['Jonas', 'Emil']);
  });

  it('keeps the full name when two people share a first name', () => {
    expect(kortNavne(['Jonas Holm', 'jonas Krogh', 'Emil'])).toEqual(['Jonas Holm', 'jonas Krogh', 'Emil']);
  });
});

describe('modtagerListe (who the Giv bøder tiles show)', () => {
  const medlem = (id: string, navn: string, ekstra: { user_id?: string | null; udmeldt?: string | null } = {}) => ({
    id,
    navn,
    user_id: 'login',
    udmeldt: null,
    ...ekstra,
  });

  it('shows you first as "Dig", then every other active Medlem A–Å', () => {
    const liste = modtagerListe(
      [medlem('o', 'Øjvind'), medlem('mig', 'Mads Ringsted'), medlem('e', 'Emil Bach', { user_id: null })],
      'mig',
    );
    expect(liste).toEqual([
      { id: 'mig', navn: 'Mads Ringsted', kortNavn: 'Dig', loggetInd: true, egen: true },
      { id: 'e', navn: 'Emil Bach', kortNavn: 'Emil', loggetInd: false, egen: false },
      { id: 'o', navn: 'Øjvind', kortNavn: 'Øjvind', loggetInd: true, egen: false },
    ]);
  });

  it('leaves out Udmeldte, and your own first name never forces a full name on others', () => {
    const liste = modtagerListe(
      [medlem('mig', 'Jonas Holm'), medlem('j', 'Jonas Krogh'), medlem('u', 'Ulla', { udmeldt: '2026-01-01' })],
      'mig',
    );
    expect(liste.map((m) => m.kortNavn)).toEqual(['Dig', 'Jonas']);
  });
});
