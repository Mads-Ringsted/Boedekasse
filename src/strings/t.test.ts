import { describe, expect, it } from 'vitest';
import { formatKr, t, tParts } from './index.ts';

describe('t (Danish string catalogue)', () => {
  it('looks up UI text by id', () => {
    expect(t('tab.hjem')).toBe('Hjem');
    expect(t('offline.titel')).toBe('Ingen forbindelse');
  });

  it('fills named placeholders', () => {
    expect(t('giv.naeste', { antal: 2 })).toBe('Næste · 2 valgt');
  });

  it('can slot in non-text values, such as bold words', () => {
    const bold = { bold: 'Del' };
    expect(tParts('installer.trin1', { del: bold })).toEqual(['Tryk på ', bold]);
  });

  it('fills several placeholders in one string', () => {
    expect(t('betaling.harBetalt', { navn: 'Emil', beloeb: formatKr(85) })).toBe(
      'Emil har betalt 85 kr',
    );
  });
});
