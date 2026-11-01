import { describe, expect, it } from 'vitest';
import { primaryAction } from '../components/fieldRules.ts';
import type { Indstillinger } from './indstillinger.ts';
import { skiftAendringer, udkastResultat, type Regel, type Udkast } from './regel.ts';
import { ANKE, ENGANGSBOEDER, FRIKOB, KONKURRENCER } from './regler.ts';

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

/** Whether Gem is on for this draft. */
function kanGemme(regel: Regel, udkast: Udkast): boolean {
  const resultat = udkastResultat(regel, ind, udkast);
  return primaryAction(resultat.krav, { unchanged: !resultat.aendret }).enabled;
}

describe('udkastResultat (what a rule sheet would save)', () => {
  it('has nothing to save until a field changes', () => {
    const resultat = udkastResultat(ANKE, ind, {});
    expect(resultat.aendret).toBe(false);
    expect(kanGemme(ANKE, {})).toBe(false);
    expect(resultat.aendringer).toEqual({});
  });

  it('saves only the fields that changed, as values, while the rule is off', () => {
    const udkast = { anke_vindue_timer: '48', anke_max_gange: '1,5' };
    expect(udkastResultat(ANKE, ind, udkast).aendringer).toEqual({ anke_vindue_timer: 48, anke_max_gange: 1.5 });
    expect(kanGemme(ANKE, udkast)).toBe(true);
  });

  it('blocks Gem and names the field when a value is wrong', () => {
    const udkast = { placeringer: '0, ti', fravaersgebyr: '40' };
    const resultat = udkastResultat(KONKURRENCER, ind, udkast);
    expect(resultat.fejl).toEqual({ placeringer: 'Skriv hele kroner adskilt af komma, fx 0, 10, 25.' });
    expect(primaryAction(resultat.krav)).toEqual({ enabled: false, reason: 'Ret feltet Gebyr pr. plads.' });
  });

  it('hides the Engangsbøde price for Fri and keeps the stored one', () => {
    const resultat = udkastResultat(ENGANGSBOEDER, { ...ind, engangs_pris_mode: 'fast', engangs_pris: 30 }, {
      engangs_pris_mode: 'fri',
      engangs_pris: '99',
    });
    expect(resultat.synlige.has('engangs_pris')).toBe(false);
    expect(resultat.aendringer).toEqual({ engangs_pris_mode: 'fri' });
  });

  it('asks for a price when Fast or Loft has none stored yet', () => {
    const resultat = udkastResultat(ENGANGSBOEDER, ind, { engangs_pris_mode: 'loft' });
    expect(resultat.fejl).toEqual({ engangs_pris: 'Skriv et beløb.' });
    expect(kanGemme(ENGANGSBOEDER, { engangs_pris_mode: 'loft' })).toBe(false);

    const medPris = udkastResultat(ENGANGSBOEDER, ind, { engangs_pris_mode: 'loft', engangs_pris: '50' });
    expect(medPris.aendringer).toEqual({ engangs_pris_mode: 'loft', engangs_pris: 50 });
  });
});

describe('skiftAendringer (what flipping a rule switch saves)', () => {
  it('saves only the switch while nothing is typed', () => {
    expect(skiftAendringer(FRIKOB, ind, {}, 'frikob_til', true)).toEqual({ ok: true, vaerdi: { frikob_til: true } });
  });

  it('saves the changed fields with the switch when it goes on, so the rule never runs with old values', () => {
    expect(skiftAendringer(ANKE, ind, { anke_vindue_timer: '48', anke_min: '10' }, 'anke_til', true)).toEqual({
      ok: true,
      vaerdi: { anke_til: true, anke_vindue_timer: 48 },
    });
  });

  it('does not turn on while a changed field is wrong, and names the field', () => {
    expect(skiftAendringer(ANKE, ind, { anke_min: '12,5' }, 'anke_til', true)).toEqual({
      ok: false,
      fejl: 'Ret feltet Mindste ankegebyr, før du slår reglen til.',
    });
  });

  it('turns off without saving what is typed, so Gem can still save it', () => {
    expect(skiftAendringer(ANKE, { ...ind, anke_til: true }, { anke_min: '30' }, 'anke_til', false)).toEqual({
      ok: true,
      vaerdi: { anke_til: false },
    });
  });

  it("leaves other sections' fields to Gem", () => {
    const udkast = { engangs_pris_mode: 'fast', engangs_pris: '30', engangsgebyr: '15' };
    expect(skiftAendringer(ENGANGSBOEDER, ind, udkast, 'engangsgebyr_til', true)).toEqual({
      ok: true,
      vaerdi: { engangsgebyr_til: true, engangsgebyr: 15 },
    });
  });
});
