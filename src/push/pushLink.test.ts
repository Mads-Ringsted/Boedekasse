import { describe, expect, it } from 'vitest';
import { laesPushLink } from './pushLink.ts';

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
