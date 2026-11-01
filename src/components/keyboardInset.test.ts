import { describe, expect, it } from 'vitest';
import { keyboardInset } from './keyboardInset.ts';

// An iPhone 15 in portrait: the layout viewport is 844 px tall.
const innerHeight = 844;

describe('keyboardInset (where a sheet sits while the keyboard is open)', () => {
  it('sits at the bottom with no keyboard', () => {
    expect(keyboardInset({ innerHeight, viewportHeight: 844, offsetTop: 0 })).toEqual({
      inset: 0,
      viewportHeight: 844,
      open: false,
    });
  });

  it('sits on top of the keyboard when the visual viewport shrinks', () => {
    expect(keyboardInset({ innerHeight, viewportHeight: 508, offsetTop: 0 })).toEqual({
      inset: 336,
      viewportHeight: 508,
      open: true,
    });
  });

  it('still lines up with the keyboard after iOS pans the visual viewport down', () => {
    // The visible part starts 120 px down, so its bottom edge is at 628 px.
    expect(keyboardInset({ innerHeight, viewportHeight: 508, offsetTop: 120 })).toEqual({
      inset: 216,
      viewportHeight: 508,
      open: true,
    });
  });

  it('counts the keyboard as open even when iOS pans so far that the inset is small', () => {
    expect(keyboardInset({ innerHeight, viewportHeight: 508, offsetTop: 320 })).toEqual({
      inset: 16,
      viewportHeight: 508,
      open: true,
    });
  });

  it('never goes below 0, e.g. during a rubber-band bounce', () => {
    expect(keyboardInset({ innerHeight, viewportHeight: 844, offsetTop: 14 }).inset).toBe(0);
  });

  it('rounds to whole pixels', () => {
    expect(keyboardInset({ innerHeight, viewportHeight: 507.6, offsetTop: 0.2 })).toEqual({
      inset: 336,
      viewportHeight: 508,
      open: true,
    });
  });

  it('does not call a small gap a keyboard (e.g. a hardware keyboard shortcut bar)', () => {
    expect(keyboardInset({ innerHeight, viewportHeight: 790, offsetTop: 0 })).toEqual({
      inset: 54,
      viewportHeight: 790,
      open: false,
    });
  });

  it('reports no inset on Android, where the page itself resizes for the keyboard', () => {
    // interactive-widget=resizes-content: innerHeight shrinks along with the viewport.
    expect(keyboardInset({ innerHeight: 520, viewportHeight: 520, offsetTop: 0 })).toEqual({
      inset: 0,
      viewportHeight: 520,
      open: false,
    });
  });
});
