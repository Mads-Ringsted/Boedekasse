import { describe, expect, it } from 'vitest';
import { kortNavne } from './navne.ts';

describe('kortNavne (names on the Giv bøder tiles)', () => {
  it('uses the first name', () => {
    expect(kortNavne(['Jonas Holm', 'Emil Bach'])).toEqual(['Jonas', 'Emil']);
  });

  it('keeps the full name when two people share a first name', () => {
    expect(kortNavne(['Jonas Holm', 'jonas Krogh', 'Emil'])).toEqual(['Jonas Holm', 'jonas Krogh', 'Emil']);
  });
});
