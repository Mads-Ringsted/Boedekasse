import { describe, expect, it } from 'vitest';
import { navnPasser } from './slet.ts';

describe('navnPasser (Slet Bødekasse confirm)', () => {
  it('matches the exact name', () => {
    expect(navnPasser('FC Ølhunde', 'FC Ølhunde')).toBe(true);
  });

  it('ignores spaces around what you typed, like the server', () => {
    expect(navnPasser('  FC Ølhunde ', 'FC Ølhunde')).toBe(true);
  });

  it('needs the same case', () => {
    expect(navnPasser('fc ølhunde', 'FC Ølhunde')).toBe(false);
  });

  it('needs the whole name', () => {
    expect(navnPasser('FC Ølhund', 'FC Ølhunde')).toBe(false);
    expect(navnPasser('', 'FC Ølhunde')).toBe(false);
  });
});
