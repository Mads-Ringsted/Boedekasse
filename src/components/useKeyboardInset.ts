import { useEffect } from 'react';
import { keyboardInset } from './keyboardInset.ts';

/** Fields that open the software keyboard. */
export function isTextField(el: Element | null): el is HTMLElement {
  if (el instanceof HTMLTextAreaElement) return true;
  if (el instanceof HTMLInputElement) {
    return !['button', 'checkbox', 'color', 'file', 'hidden', 'image', 'radio', 'range', 'reset', 'submit'].includes(
      el.type,
    );
  }
  return el instanceof HTMLElement && el.isContentEditable;
}

/** Scrolls the focused field inside `sheet` into view, as little as possible. */
export function revealFocusedField(sheet: HTMLElement) {
  const focused = document.activeElement;
  if (isTextField(focused) && sheet.contains(focused)) focused.scrollIntoView({ block: 'nearest' });
}

/**
 * Keeps a bottom sheet on top of the keyboard (see `keyboardInset`). Sets
 * `--keyboard-inset` and `--viewport-height` on the sheet, and
 * `data-keyboard="open"` while a keyboard is up. iOS also pans the page to
 * show the field; the sheet already follows the keyboard, so the page is put
 * back where it was when the sheet opened.
 */
export function useKeyboardInset(sheet: HTMLElement | null) {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!sheet || !viewport) return;
    const scrollY = window.scrollY;
    let frame = 0;

    function resetPage() {
      if (window.scrollY !== scrollY) window.scrollTo(0, scrollY);
    }

    function update() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!sheet || !viewport) return;
        const m = keyboardInset({
          innerHeight: window.innerHeight,
          viewportHeight: viewport.height,
          offsetTop: viewport.offsetTop,
        });
        sheet.style.setProperty('--keyboard-inset', `${m.inset}px`);
        sheet.style.setProperty('--viewport-height', `${m.viewportHeight}px`);
        if (m.open) {
          sheet.dataset.keyboard = 'open';
          revealFocusedField(sheet);
        } else {
          delete sheet.dataset.keyboard;
        }
        resetPage();
      });
    }

    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    window.addEventListener('scroll', update);
    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
      window.removeEventListener('scroll', update);
      resetPage();
    };
  }, [sheet]);
}
