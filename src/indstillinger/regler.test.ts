import { describe, expect, it } from 'vitest';
import { ankeStatus, engangsStatus, frikobStatus, konkurrenceStatus } from './regler.ts';

describe('engangsStatus (the Engangsbøder row: always available, so never Fra)', () => {
  const fri = { engangs_pris_mode: 'fri', engangs_pris: null, engangsgebyr_til: false, engangsgebyr: 10 } as const;

  it('reads the price mode', () => {
    expect(engangsStatus(fri)).toEqual({ til: true, tekst: 'Fri' });
    expect(engangsStatus({ ...fri, engangs_pris_mode: 'fast', engangs_pris: 30 }).tekst).toBe('Fast · 30 kr');
    expect(engangsStatus({ ...fri, engangs_pris_mode: 'loft', engangs_pris: 50 }).tekst).toBe('Højst 50 kr');
  });

  it('adds the Gebyr only while it is on', () => {
    expect(engangsStatus({ ...fri, engangsgebyr_til: true }).tekst).toBe('Fri · gebyr 10 kr');
    expect(
      engangsStatus({ ...fri, engangs_pris_mode: 'loft', engangs_pris: 50, engangsgebyr_til: true }).tekst,
    ).toBe('Højst 50 kr · gebyr 10 kr');
  });
});

describe('ankeStatus (the Anke row)', () => {
  it('reads the Ankefrist when on', () => {
    expect(ankeStatus({ anke_til: true, anke_vindue_timer: 24 })).toEqual({ til: true, tekst: 'Til · 24 timer' });
  });

  it('says Fra when off', () => {
    expect(ankeStatus({ anke_til: false, anke_vindue_timer: 24 })).toEqual({ til: false, tekst: 'Fra' });
  });
});

describe('frikobStatus (the Frikøb row)', () => {
  it('reads the price when on', () => {
    expect(frikobStatus({ frikob_til: true, frikob_pris: 300 })).toEqual({ til: true, tekst: 'Til · 300 kr' });
  });

  it('says Fra when off', () => {
    expect(frikobStatus({ frikob_til: false, frikob_pris: 300 })).toEqual({ til: false, tekst: 'Fra' });
  });
});

describe('konkurrenceStatus (the Konkurrencer row)', () => {
  it('reads the placement range and the absent Gebyr when on', () => {
    expect(
      konkurrenceStatus({ konkurrence_til: true, placeringer: [0, 10, 25, 35, 40, 45, 50], fravaersgebyr: 50 }),
    ).toEqual({ til: true, tekst: 'Til · 0–50 kr · fravær 50 kr' });
  });

  it('shows one amount when every place pays the same', () => {
    expect(konkurrenceStatus({ konkurrence_til: true, placeringer: [25, 25], fravaersgebyr: 50 }).tekst).toBe(
      'Til · 25 kr · fravær 50 kr',
    );
  });

  it('says Fra with no amount when off', () => {
    expect(konkurrenceStatus({ konkurrence_til: false, placeringer: [0, 50], fravaersgebyr: 50 })).toEqual({
      til: false,
      tekst: 'Fra',
    });
  });
});
