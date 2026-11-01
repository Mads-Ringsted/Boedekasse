import { describe, expect, it } from 'vitest';
import { laesBoedeLink, laesPushLink } from './pushLink.ts';

const KASSE = '6f1c2a4e-0b7d-4a51-9a63-2f0e8f3d9c11';

describe('laesPushLink (a tapped push opens the right box)', () => {
  it('reads the box from a push link and drops it from the address', () => {
    expect(laesPushLink(`?bodekasse=${KASSE}`)).toEqual({ bodekasseId: KASSE, search: '' });
  });

  it('keeps the other query parameters', () => {
    expect(laesPushLink(`?a=1&bodekasse=${KASSE}`)).toEqual({ bodekasseId: KASSE, search: '?a=1' });
  });

  it('is null for an ordinary address', () => {
    expect(laesPushLink('')).toBeNull();
    expect(laesPushLink('?installer')).toBeNull();
  });

  it('ignores a value that is not a box id', () => {
    expect(laesPushLink('?bodekasse=hej')).toBeNull();
  });
});

const BOEDE = '0a8e7c55-3d2f-4b19-8e60-7c4d1f2b9a03';

describe('laesBoedeLink (an Anke push opens its Bøde)', () => {
  it('reads the Bøde from the address and drops it', () => {
    expect(laesBoedeLink(`?bode=${BOEDE}`)).toEqual({ boedeId: BOEDE, search: '' });
  });

  it('keeps the other query parameters', () => {
    expect(laesBoedeLink(`?a=1&bode=${BOEDE}`)).toEqual({ boedeId: BOEDE, search: '?a=1' });
  });

  it('is null without a Bøde id', () => {
    expect(laesBoedeLink('')).toBeNull();
    expect(laesBoedeLink('?bode=hej')).toBeNull();
  });
});
