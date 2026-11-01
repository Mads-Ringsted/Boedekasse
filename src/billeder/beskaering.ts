/**
 * Profilbillede crop and resize maths: pure, so Vitest can test them.
 * Drawing and exporting is in `tegnBillede.ts`; the crop UI is `BeskaerFoto.tsx`.
 */

/** A square in the source photo, in source pixels. */
export interface Kvadrat {
  x: number;
  y: number;
  side: number;
}

/** A photo's size in source pixels (a `Foto` fits). */
export interface Maal {
  bredde: number;
  hoejde: number;
}

/**
 * Where the crop is: the centre of the visible square, in source px, and the
 * zoom. Zoom 1 fills the circle with the photo's short side.
 */
export interface Beskaering {
  cx: number;
  cy: number;
  zoom: number;
}

/** The crop when a photo is picked: its centre, zoomed out as far as it goes. */
export function startBeskaering(foto: Maal): Beskaering {
  return { cx: foto.bredde / 2, cy: foto.hoejde / 2, zoom: 1 };
}

/** The square of the photo the round crop shows, in source px. */
export function synligKvadrat(b: Beskaering, foto: Maal): Kvadrat {
  const side = Math.min(foto.bredde, foto.hoejde) / b.zoom;
  return { x: b.cx - side / 2, y: b.cy - side / 2, side };
}

/** Zoom 1 fills the circle; you can't zoom out past it. */
export const MIN_ZOOM = 1;

/** How far in you can zoom: a quarter of the short side fills the circle. */
export const MAKS_ZOOM = 4;

function mellem(min: number, vaerdi: number, maks: number): number {
  return Math.min(maks, Math.max(min, vaerdi));
}

/** Keeps the zoom within its limits and the photo over the whole circle. */
function klem(b: Beskaering, foto: Maal): Beskaering {
  const zoom = mellem(MIN_ZOOM, b.zoom, MAKS_ZOOM);
  const halv = Math.min(foto.bredde, foto.hoejde) / zoom / 2;
  return {
    cx: mellem(halv, b.cx, foto.bredde - halv),
    cy: mellem(halv, b.cy, foto.hoejde - halv),
    zoom,
  };
}

/** Sets the zoom (the slider), keeping the middle of the circle where it is. */
export function zoomTil(b: Beskaering, foto: Maal, zoom: number): Beskaering {
  return klem({ ...b, zoom }, foto);
}

/** A finger on the crop circle, in css px from its top-left corner. */
export interface Punkt {
  x: number;
  y: number;
}

function midt(punkter: Punkt[]): Punkt {
  const x = punkter.reduce((sum, p) => sum + p.x, 0) / punkter.length;
  const y = punkter.reduce((sum, p) => sum + p.y, 0) / punkter.length;
  return { x, y };
}

/** How far apart two fingers are; 0 for one finger. */
function spred(punkter: Punkt[]): number {
  if (punkter.length < 2) return 0;
  return Math.hypot(punkter[1].x - punkter[0].x, punkter[1].y - punkter[0].y);
}

/**
 * Follows the fingers from `foer` to `efter` on a crop circle `rude` css px
 * across. One finger drags the photo. Two fingers drag by their midpoint and
 * zoom by their spread, keeping the photo point between them under them.
 */
export function flyt(b: Beskaering, foto: Maal, rude: number, foer: Punkt[], efter: Punkt[]): Beskaering {
  if (foer.length === 0 || foer.length !== efter.length) return b;
  const fra = midt(foer);
  const til = midt(efter);
  const kort = Math.min(foto.bredde, foto.hoejde);

  // The photo point under the fingers before they moved.
  const foerPrPx = kort / b.zoom / rude;
  const kildeX = b.cx + (fra.x - rude / 2) * foerPrPx;
  const kildeY = b.cy + (fra.y - rude / 2) * foerPrPx;

  const spredFoer = spred(foer);
  const zoom = spredFoer > 0 ? mellem(MIN_ZOOM, (b.zoom * spred(efter)) / spredFoer, MAKS_ZOOM) : b.zoom;

  // Put that point under the fingers where they are now.
  const efterPrPx = kort / zoom / rude;
  return klem(
    { cx: kildeX - (til.x - rude / 2) * efterPrPx, cy: kildeY - (til.y - rude / 2) * efterPrPx, zoom },
    foto,
  );
}

/** The saved picture's width and height, in px. */
export const UD_PX = 512;

/** The saved picture's side: the crop shrunk to `UD_PX`, never blown up. */
export function udSide(kvadrat: Kvadrat): number {
  return Math.min(UD_PX, Math.round(kvadrat.side));
}
