import { describe, expect, it } from 'vitest';
import type { Boede } from '../aktivitet/haendelse.ts';
import type { AnkeRegler } from '../anke/anke.ts';
import type { Melding } from '../betal/betal.ts';
import { venterPaaDig } from './venterPaaDig.ts';

const nu = new Date('2026-10-11T18:00:00Z');
const regler: AnkeRegler = { til: true, vindueTimer: 24, min: 1, maxGange: 2, aktivSaesonId: 's1' };

const boede = (over: Partial<Boede> = {}): Boede => ({
  id: 'b1',
  saesonId: 's1',
  batchId: 'batch',
  giverId: 'frederik',
  giverNavn: 'Frederik Lund',
  modtagerId: 'emil',
  modtagerNavn: 'Emil Bach',
  bodekategoriId: 'k1',
  navn: 'For sent',
  engangsbode: false,
  pris: 50,
  givet: '2026-10-11T13:00:00Z',
  ankeId: null,
  afgoerelse: null,
  anket: false,
  afgoerelseAendret: false,
  baererId: 'emil',
  annullering: null,
  gebyr: 0,
  afgjort: null,
  aendret: null,
  ankeGebyr: null,
  ankeGebyrId: null,
  ...over,
});

const melding = (medlemId: string): Melding => ({
  id: `m-${medlemId}`,
  medlemId,
  navn: medlemId,
  fuldtNavn: medlemId,
  beloeb: 120,
  meldt: '2026-10-11T12:00:00Z',
});

describe('venterPaaDig (the "Venter på dig" card on your own profile)', () => {
  it('is hidden when nothing waits on you', () => {
    expect(venterPaaDig({ meldinger: [], migId: 'emil', regler, boeder: [] }, nu)).toBeNull();
  });

  it('ignores reports from other Medlemmer', () => {
    expect(venterPaaDig({ meldinger: [melding('frederik')], migId: 'emil', regler, boeder: [] }, nu)).toBeNull();
  });

  it('shows your own report that afventer', () => {
    expect(
      venterPaaDig({ meldinger: [melding('frederik'), melding('emil')], migId: 'emil', regler, boeder: [] }, nu),
    ).toEqual({ melding: melding('emil'), anker: [] });
  });

  it('lists each Bøde you can still appeal, with the time left', () => {
    expect(venterPaaDig({ meldinger: [], migId: 'emil', regler, boeder: [boede()] }, nu)).toEqual({
      melding: null,
      anker: [{ boede: boede(), msTilbage: 19 * 3_600_000 }],
    });
  });

  it('is hidden when the only Bøde has closed its Anke window since it was loaded', () => {
    const forLaengeSiden = boede({ givet: '2026-10-10T17:00:00Z' });
    expect(venterPaaDig({ meldinger: [], migId: 'emil', regler, boeder: [forLaengeSiden] }, nu)).toBeNull();
  });

  it('shows the report and the Bøder together', () => {
    expect(venterPaaDig({ meldinger: [melding('emil')], migId: 'emil', regler, boeder: [boede()] }, nu)).toEqual({
      melding: melding('emil'),
      anker: [{ boede: boede(), msTilbage: 19 * 3_600_000 }],
    });
  });
});
