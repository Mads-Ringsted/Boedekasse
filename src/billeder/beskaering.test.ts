import { describe, expect, it } from 'vitest';
import { midterKvadrat, udSide } from './beskaering.ts';

describe('midterKvadrat: the centre square of a photo', () => {
  it('cuts the sides off a landscape photo', () => {
    expect(midterKvadrat(4000, 3000)).toEqual({ x: 500, y: 0, side: 3000 });
  });

  it('cuts the top and bottom off a portrait photo', () => {
    expect(midterKvadrat(1080, 1920)).toEqual({ x: 0, y: 420, side: 1080 });
  });

  it('keeps a square photo whole', () => {
    expect(midterKvadrat(800, 800)).toEqual({ x: 0, y: 0, side: 800 });
  });

  it('lands on whole pixels when the difference is odd', () => {
    expect(midterKvadrat(1001, 1000)).toEqual({ x: 0, y: 0, side: 1000 });
  });
});

describe('udSide: how big the saved picture is', () => {
  it('shrinks a phone photo to 512 px', () => {
    expect(udSide({ x: 500, y: 0, side: 3000 })).toBe(512);
  });

  it('never blows a small photo up', () => {
    expect(udSide({ x: 0, y: 0, side: 300 })).toBe(300);
  });
});
