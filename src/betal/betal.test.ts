import { describe, expect, it } from 'vitest';
import { afventerTilMig, meldtTekst, minMelding, type Melding } from './betal.ts';

const melding = (id: string, medlemId: string, meldt: string): Melding => ({
  id,
  medlemId,
  navn: medlemId,
  beloeb: 85,
  meldt,
});

describe('afventerTilMig (the reports I can confirm or reject)', () => {
  const meldinger = [
    melding('2', 'emil', '2026-10-11T10:05:00Z'),
    melding('1', 'mig', '2026-10-11T10:00:00Z'),
    melding('3', 'bo', '2026-10-11T09:00:00Z'),
  ];

  it("shows everyone's report but my own, oldest first", () => {
    expect(afventerTilMig(meldinger, 'mig', false).map((m) => m.id)).toEqual(['3', '2']);
  });

  it('shows my own report too when I am an Admin', () => {
    expect(afventerTilMig(meldinger, 'mig', true).map((m) => m.id)).toEqual(['3', '1', '2']);
  });
});

describe('minMelding (my own report that afventer)', () => {
  it('is my report, or null when I have none', () => {
    const meldinger = [melding('1', 'emil', '2026-10-11T10:00:00Z'), melding('2', 'mig', '2026-10-11T10:00:00Z')];
    expect(minMelding(meldinger, 'mig')?.id).toBe('2');
    expect(minMelding(meldinger, 'bo')).toBeNull();
  });
});

describe('meldtTekst (when a report was made)', () => {
  const nu = new Date('2026-10-11T12:00:00Z');

  it('says "lige nu", minutes, hours, then a date', () => {
    expect(meldtTekst('2026-10-11T11:59:30Z', nu)).toBe('Meldt lige nu');
    expect(meldtTekst('2026-10-11T11:50:00Z', nu)).toBe('Meldt for 10 min siden');
    expect(meldtTekst('2026-10-11T09:00:00Z', nu)).toBe('Meldt for 3 t siden');
    expect(meldtTekst('2026-10-08T09:00:00Z', nu)).toBe('Meldt 8. okt');
  });
});
