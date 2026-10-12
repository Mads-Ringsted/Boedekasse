import { describe, expect, it } from 'vitest';
import { formatKr } from './index.ts';

describe('formatKr', () => {
  it('writes thousands with a dot and "kr" after a space', () => {
    expect(formatKr(1250)).toBe('1.250 kr');
  });

  it('writes small amounts without a separator', () => {
    expect(formatKr(0)).toBe('0 kr');
    expect(formatKr(6)).toBe('6 kr');
    expect(formatKr(570)).toBe('570 kr');
  });

  it('groups every three digits in large amounts', () => {
    expect(formatKr(1000000)).toBe('1.000.000 kr');
  });

  it('keeps the minus sign on a negative amount', () => {
    expect(formatKr(-1250)).toBe('-1.250 kr');
  });
});
