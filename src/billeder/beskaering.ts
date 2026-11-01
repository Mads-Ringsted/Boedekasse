/**
 * Profilbillede crop and resize maths: pure, so Vitest can test them.
 * Drawing and exporting is in `tegnBillede.ts`.
 */

/** A square in the source photo, in source pixels. */
export interface Kvadrat {
  x: number;
  y: number;
  side: number;
}

/** The largest square in the middle of a photo. */
export function midterKvadrat(bredde: number, hoejde: number): Kvadrat {
  const side = Math.min(bredde, hoejde);
  return { x: Math.floor((bredde - side) / 2), y: Math.floor((hoejde - side) / 2), side };
}

/** The saved picture's width and height, in px. */
export const UD_PX = 512;

/** The saved picture's side: the crop shrunk to `UD_PX`, never blown up. */
export function udSide(kvadrat: Kvadrat): number {
  return Math.min(UD_PX, Math.round(kvadrat.side));
}
