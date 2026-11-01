import { describe, expect, it } from 'vitest';
import {
  catchUpStatus,
  dosBonusStatus,
  engangsgebyrStatus,
  gebyrerStatus,
  oprettelsesgebyrStatus,
  senBetalingStatus,
} from './gebyrer.ts';

describe('catchUpStatus (the Catch-up row)', () => {
  it('says who pays what and when, when on', () => {
    expect(catchUpStatus({ catch_up_til: true, catch_up_antal: 2, catch_up_beloeb: 20 })).toEqual({
      til: true,
      tekst: 'Til · De 2 laveste betaler 20 kr d. 1.',
    });
  });

  it('reads well for one Medlem', () => {
    expect(catchUpStatus({ catch_up_til: true, catch_up_antal: 1, catch_up_beloeb: 20 }).tekst).toBe(
      'Til · Den laveste betaler 20 kr d. 1.',
    );
  });

  it('says Fra with no amount when off', () => {
    expect(catchUpStatus({ catch_up_til: false, catch_up_antal: 2, catch_up_beloeb: 20 })).toEqual({
      til: false,
      tekst: 'Fra',
    });
  });
});

describe('senBetalingStatus (the Sen betaling row)', () => {
  const sen = { sen_betaling_til: true, sen_betaling_beloeb: 20, betalingsdag: 5, sen_betaling_loft: null };

  it('reads the amount per day and the Betalingsdag when on', () => {
    expect(senBetalingStatus(sen)).toEqual({ til: true, tekst: 'Til · 20 kr pr. dag efter den 5.' });
  });

  it('adds the cap with no stray full stop before it', () => {
    expect(senBetalingStatus({ ...sen, sen_betaling_loft: 100 }).tekst).toBe(
      'Til · 20 kr pr. dag efter den 5., højst 100 kr om måneden',
    );
  });

  it('says Fra with no amount when off', () => {
    expect(senBetalingStatus({ ...sen, sen_betaling_til: false, sen_betaling_loft: 100 })).toEqual({
      til: false,
      tekst: 'Fra',
    });
  });
});

describe('the single-amount Gebyrer (Ny bødekategori, Engangsbøde, Dos-bonus)', () => {
  it('read the amount when on', () => {
    expect(oprettelsesgebyrStatus({ oprettelsesgebyr_til: true, oprettelsesgebyr: 25 })).toEqual({
      til: true,
      tekst: 'Til · 25 kr',
    });
    expect(engangsgebyrStatus({ engangsgebyr_til: true, engangsgebyr: 10 }).tekst).toBe('Til · 10 kr');
    expect(dosBonusStatus({ dos_bonus_til: true, dos_bonus_beloeb: 50 }).tekst).toBe('Til · 50 kr');
  });

  it('say Fra with no amount when off', () => {
    const fra = { til: false, tekst: 'Fra' };
    expect(oprettelsesgebyrStatus({ oprettelsesgebyr_til: false, oprettelsesgebyr: 25 })).toEqual(fra);
    expect(engangsgebyrStatus({ engangsgebyr_til: false, engangsgebyr: 10 })).toEqual(fra);
    expect(dosBonusStatus({ dos_bonus_til: false, dos_bonus_beloeb: 50 })).toEqual(fra);
  });
});

describe('gebyrerStatus (the Gebyrer row on the hub)', () => {
  const alleFra = {
    oprettelsesgebyr_til: false,
    engangsgebyr_til: false,
    dos_bonus_til: false,
    catch_up_til: false,
    sen_betaling_til: false,
  };

  it('counts the Gebyrer that are on', () => {
    expect(gebyrerStatus({ ...alleFra, oprettelsesgebyr_til: true, dos_bonus_til: true, sen_betaling_til: true })).toEqual({
      til: true,
      tekst: '3 slået til',
    });
    expect(gebyrerStatus({ ...alleFra, catch_up_til: true }).tekst).toBe('1 slået til');
  });

  it('counts all five', () => {
    expect(
      gebyrerStatus({
        oprettelsesgebyr_til: true,
        engangsgebyr_til: true,
        dos_bonus_til: true,
        catch_up_til: true,
        sen_betaling_til: true,
      }).tekst,
    ).toBe('5 slået til');
  });

  it('is muted when none are on', () => {
    expect(gebyrerStatus(alleFra)).toEqual({ til: false, tekst: 'Ingen slået til' });
  });
});
