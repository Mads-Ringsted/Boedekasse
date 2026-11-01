import { describe, expect, it } from 'vitest';
import { andreKasser, billedSti, kopiStier, skalSigneres, visBillede } from './billede.ts';

describe('billedSti', () => {
  it('puts the file in the Medlem’s folder in that box, with a fresh name', () => {
    expect(billedSti('kasse-1', 'medlem-2', 'image/webp', 'abc')).toBe('kasse-1/medlem-2/abc.webp');
    expect(billedSti('kasse-1', 'medlem-2', 'image/jpeg', 'abc')).toBe('kasse-1/medlem-2/abc.jpg');
  });

  it('gives each upload a new name', () => {
    expect(billedSti('k', 'm', 'image/webp')).not.toBe(billedSti('k', 'm', 'image/webp'));
  });
});

describe('visBillede: picture or initials', () => {
  it('shows the picture when there is a URL', () => {
    expect(visBillede({ url: 'https://x/a.webp' })).toBe(true);
  });

  it('shows initials when there is no picture', () => {
    expect(visBillede({ url: undefined })).toBe(false);
    expect(visBillede({ url: '' })).toBe(false);
  });

  it('shows initials for a Medlem who hasn’t signed up, even with a URL', () => {
    expect(visBillede({ url: 'https://x/a.webp', stiplet: true })).toBe(false);
  });

  it('shows initials when that URL failed to load', () => {
    expect(visBillede({ url: 'https://x/a.webp', fejletUrl: 'https://x/a.webp' })).toBe(false);
  });

  it('tries again when a new URL replaces the one that failed', () => {
    expect(visBillede({ url: 'https://x/b.webp', fejletUrl: 'https://x/a.webp' })).toBe(true);
  });

  it('keeps the picture for an Udmeldt Medlem (the grey style is CSS)', () => {
    expect(visBillede({ url: 'https://x/a.webp', tidligere: true })).toBe(true);
  });
});

describe('skalSigneres: which paths need a new signed URL', () => {
  const nu = 1_000_000;
  const cache = new Map([
    ['frisk', { url: 'u1', udloeber: nu + 2 * 60 * 60 * 1000 }],
    ['snart', { url: 'u2', udloeber: nu + 5 * 60 * 1000 }],
  ]);

  it('signs paths it has never signed, once each', () => {
    expect(skalSigneres(['ny', 'ny', 'frisk'], cache, nu)).toEqual(['ny']);
  });

  it('signs again a URL that expires within the hour', () => {
    expect(skalSigneres(['frisk', 'snart'], cache, nu)).toEqual(['snart']);
  });

  it('signs nothing when every URL is fresh', () => {
    expect(skalSigneres(['frisk'], cache, nu)).toEqual([]);
  });
});

describe('Brug også i mine andre bødekasser', () => {
  const mine = [
    { bodekasseId: 'kasse-a', medlemId: 'mig-a' },
    { bodekasseId: 'kasse-b', medlemId: 'mig-b' },
    { bodekasseId: 'kasse-c', medlemId: 'mig-c' },
  ];

  it('targets your Medlem in every other box, not the one you saved in', () => {
    expect(andreKasser(mine, 'kasse-b')).toEqual([
      { bodekasseId: 'kasse-a', medlemId: 'mig-a' },
      { bodekasseId: 'kasse-c', medlemId: 'mig-c' },
    ]);
  });

  it('has no targets when you are in one box only', () => {
    expect(andreKasser([{ bodekasseId: 'kasse-a', medlemId: 'mig-a' }], 'kasse-a')).toEqual([]);
  });

  it('puts each copy in that Medlem’s own folder, with a fresh name and the same type', () => {
    const navne = ['n1', 'n2'];
    expect(kopiStier(mine, 'kasse-a', 'image/jpeg', () => navne.shift()!)).toEqual([
      'kasse-b/mig-b/n1.jpg',
      'kasse-c/mig-c/n2.jpg',
    ]);
  });
});
