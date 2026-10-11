import { describe, expect, it } from 'vitest';
import { rensJoinKode } from './joinKode.ts';

describe('rensJoinKode (what lands in the six code boxes on Jeg har en kode)', () => {
  it('shows typed letters in capitals', () => {
    expect(rensJoinKode('k7p')).toBe('K7P');
  });

  it('drops spaces and dashes from a pasted code', () => {
    expect(rensJoinKode('K7P 2QX')).toBe('K7P2QX');
    expect(rensJoinKode('k7-p2-qx')).toBe('K7P2QX');
  });

  it('never holds more than six characters', () => {
    expect(rensJoinKode('K7P2QXY')).toBe('K7P2QX');
  });
});
