import { describe, expect, it } from 'vitest';
import { givLinjer, nytValg, opsummer, plusAlle, plusPerson, vaelgAlle } from '../giv/valg.ts';
import { frikobIGiv, frikobRegler, iSaeson, type AktivtFrikob } from './frikob.ts';

const frikob = (medlemId: string, bodekategoriId: string): AktivtFrikob => ({
  id: `${medlemId}-${bodekategoriId}`,
  medlemId,
  medlemNavn: medlemId,
  bodekategoriId,
  bodekategoriNavn: bodekategoriId,
  koebt: '2026-10-01T12:00:00Z',
  pris: 300,
});

const kategorier = [
  { id: 'for-sent', navn: 'For sent', pris: 50 },
  { id: 'spildt', navn: 'Spildt drikke', pris: 20 },
];

describe('Frikøb in Giv bøder', () => {
  it('"everyone" skips the person who bought the Bødekategori out, and 3b refuses it', () => {
    const regler = frikobRegler([frikob('oliver', 'for-sent')]);
    let valg = vaelgAlle(nytValg(), ['jonas', 'oliver'], regler);
    valg = plusAlle(valg, 'for-sent', regler);
    valg = plusAlle(valg, 'spildt', regler);
    valg = plusPerson(valg, 'oliver', 'for-sent', regler);

    expect(givLinjer(valg)).toEqual([
      { modtager_id: 'jonas', bodekategori_id: 'for-sent', antal: 1 },
      { modtager_id: 'jonas', bodekategori_id: 'spildt', antal: 1 },
      { modtager_id: 'oliver', bodekategori_id: 'spildt', antal: 1 },
    ]);
    expect(opsummer(valg, kategorier).beloeb).toBe(90);
  });

  it('a Frikøb only covers its own holder and Bødekategori', () => {
    const regler = frikobRegler([frikob('oliver', 'for-sent')]);
    expect(regler.kanFaa('oliver', 'for-sent')).toBe(false);
    expect(regler.kanFaa('oliver', 'spildt')).toBe(true);
    expect(regler.kanFaa('jonas', 'for-sent')).toBe(true);
  });

  it('step 2 says who holds the Frikøb and who still gets the Bøde', () => {
    const regler = frikobRegler([frikob('oliver', 'for-sent')]);
    const valgte = [
      { id: 'jonas', kortNavn: 'Jonas' },
      { id: 'oliver', kortNavn: 'Oliver' },
    ];
    expect(frikobIGiv(valgte, 'for-sent', regler)).toEqual({ holdere: ['Oliver'], modtagere: ['Jonas'] });
    expect(frikobIGiv(valgte, 'spildt', regler)).toBeNull();
    expect(frikobIGiv([valgte[1]], 'for-sent', regler)).toEqual({ holdere: ['Oliver'], modtagere: [] });
  });
});

describe('iSaeson', () => {
  it('reads "Frikøb i sæson 2026" for a Sæson named "Sæson 2026"', () => {
    expect(iSaeson('Sæson 2026')).toBe('sæson 2026');
  });
});
