import { describe, expect, it } from 'vitest';
import { forbogstav, initialer } from './initialer.ts';

describe('initialer (the letters on a Medlem\'s avatar)', () => {
  it('uses the first letters of the first and last name', () => {
    expect(initialer('Mads Ringsted')).toBe('MR');
    expect(initialer('Anne-Marie Holm Jensen')).toBe('AJ');
  });

  it('uses one letter for a single name, in capitals', () => {
    expect(initialer('  emil ')).toBe('E');
  });

  it('keeps letters outside A–Z whole', () => {
    expect(initialer('Øjvind Ågård')).toBe('ØÅ');
  });
});

describe('forbogstav (the letter on a Bødekasse tile)', () => {
  it('is the first letter of the box name, in capitals', () => {
    expect(forbogstav('FC Ølhunde')).toBe('F');
    expect(forbogstav('poker-tirsdag')).toBe('P');
  });
});
