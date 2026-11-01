import { describe, expect, it } from 'vitest';
import type { Indstillinger } from './indstillinger.ts';
import { udkastResultat } from './regel.ts';
import { ANKE, ENGANGSBOEDER, KONKURRENCER } from './regler.ts';

const ind: Indstillinger = {
  id: 'kasse',
  navn: 'Holdet',
  oprettet: '2026-01-01T00:00:00Z',
  mobilepay_box: null,
  anke_til: false,
  anke_vindue_timer: 24,
  anke_min: 10,
  anke_max_gange: 2,
  frikob_til: false,
  frikob_pris: 300,
  konkurrence_til: false,
  placeringer: [0, 10, 25],
  fravaersgebyr: 50,
  engangs_pris_mode: 'fri',
  engangs_pris: null,
  engangsgebyr_til: false,
  engangsgebyr: 10,
  oprettelsesgebyr_til: false,
  oprettelsesgebyr: 20,
  dos_bonus_til: false,
  dos_bonus_beloeb: 20,
  catch_up_til: false,
  catch_up_til_siden: null,
  catch_up_beloeb: 20,
  catch_up_antal: 2,
  sen_betaling_til: false,
  sen_betaling_til_siden: null,
  sen_betaling_beloeb: 5,
  sen_betaling_loft: null,
  betalingsdag: 1,
};

describe('udkastResultat (what a rule sheet would save)', () => {
  it('has nothing to save until a field changes', () => {
    const r = udkastResultat(ANKE, ind, {});
    expect(r.aendret).toBe(false);
    expect(r.kanGemme).toBe(false);
    expect(r.aendringer).toEqual({});
  });

  it('saves only the fields that changed, as values, while the rule is off', () => {
    const r = udkastResultat(ANKE, ind, { anke_vindue_timer: '48', anke_max_gange: '1,5' });
    expect(r.aendringer).toEqual({ anke_vindue_timer: 48, anke_max_gange: 1.5 });
    expect(r.kanGemme).toBe(true);
  });

  it('blocks Gem and names the field when a value is wrong', () => {
    const r = udkastResultat(KONKURRENCER, ind, { placeringer: '0, ti', fravaersgebyr: '40' });
    expect(r.fejl).toEqual({ placeringer: 'Skriv hele kroner adskilt af komma, fx 0, 10, 25.' });
    expect(r.kanGemme).toBe(false);
  });

  it('hides the Engangsbøde price for Fri and keeps the stored one', () => {
    const r = udkastResultat(ENGANGSBOEDER, { ...ind, engangs_pris_mode: 'fast', engangs_pris: 30 }, {
      engangs_pris_mode: 'fri',
      engangs_pris: '99',
    });
    expect(r.synlige.has('engangs_pris')).toBe(false);
    expect(r.aendringer).toEqual({ engangs_pris_mode: 'fri' });
  });

  it('asks for a price when Fast or Loft has none stored yet', () => {
    const r = udkastResultat(ENGANGSBOEDER, ind, { engangs_pris_mode: 'loft' });
    expect(r.fejl).toEqual({ engangs_pris: 'Skriv et beløb.' });
    expect(r.kanGemme).toBe(false);

    const medPris = udkastResultat(ENGANGSBOEDER, ind, { engangs_pris_mode: 'loft', engangs_pris: '50' });
    expect(medPris.aendringer).toEqual({ engangs_pris_mode: 'loft', engangs_pris: 50 });
  });
});
