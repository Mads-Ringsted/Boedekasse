/** What `window` and `window.visualViewport` report, in CSS pixels. */
export interface ViewportMaal {
  /** `window.innerHeight`: the layout viewport, which iOS never shrinks for the keyboard. */
  innerHeight: number;
  /** `visualViewport.height`: the part above the keyboard. */
  viewportHeight: number;
  /** `visualViewport.offsetTop`: how far iOS has panned the visible part down. */
  offsetTop: number;
}

export interface KeyboardInset {
  /** How far above the layout viewport's bottom a fixed sheet must sit to rest on the keyboard. */
  inset: number;
  /** The visible height, for the sheet's max height. */
  viewportHeight: number;
  /** True while a software keyboard covers part of the screen. */
  open: boolean;
}

/**
 * Less than this is a hardware keyboard's shortcut bar or rounding, not a
 * software keyboard. The smallest iPhone keyboard is well above it.
 */
const KEYBOARD_MIN = 100;

/**
 * Where a bottom sheet sits so the keyboard never covers it. iOS standalone
 * apps keep `innerHeight` when the keyboard opens and only shrink the visual
 * viewport, so `position: fixed; bottom: 0` ends up behind the keyboard.
 */
export function keyboardInset({ innerHeight, viewportHeight, offsetTop }: ViewportMaal): KeyboardInset {
  return {
    inset: Math.max(0, Math.round(innerHeight - viewportHeight - offsetTop)),
    viewportHeight: Math.round(viewportHeight),
    open: innerHeight - viewportHeight >= KEYBOARD_MIN,
  };
}
