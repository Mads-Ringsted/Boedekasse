import type { BilledType } from './billede.ts';
import { udSide, type Kvadrat } from './beskaering.ts';

/**
 * Profilbillede in the browser: open a picked photo and draw a square of it
 * small enough to upload. The maths is in `beskaering.ts`.
 */

/** A decoded photo, the right way up, and its size in px. */
export interface Foto {
  kilde: CanvasImageSource;
  bredde: number;
  hoejde: number;
  /** Frees the decoded photo. Call it when you are done drawing. */
  luk: () => void;
}

/**
 * Decodes a picked file. Both ways honour the EXIF rotation, so phone
 * photos come out upright. Rejects when the browser can't read the file.
 */
export async function aabnFoto(fil: Blob): Promise<Foto> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(fil, { imageOrientation: 'from-image' });
      return { kilde: bitmap, bredde: bitmap.width, hoejde: bitmap.height, luk: () => bitmap.close() };
    } catch {
      // Some browsers can't do this type as a bitmap; try an <img>.
    }
  }
  const url = URL.createObjectURL(fil);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return { kilde: img, bredde: img.naturalWidth, hoejde: img.naturalHeight, luk: () => {} };
  } finally {
    URL.revokeObjectURL(url);
  }
}

const KVALITET = 0.85;

function somBlob(canvas: HTMLCanvasElement, type: BilledType): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, KVALITET));
}

/**
 * Draws `kvadrat` of the photo at `udSide` px and exports it as WebP, or as
 * JPEG where the browser can't make WebP (it then hands back PNG or nothing).
 */
export async function tegnKvadrat(foto: Foto, kvadrat: Kvadrat): Promise<{ blob: Blob; type: BilledType }> {
  const side = udSide(kvadrat);
  const canvas = document.createElement('canvas');
  canvas.width = side;
  canvas.height = side;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  // JPEG has no transparency: a see-through PNG gets white, not black.
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, side, side);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(foto.kilde, kvadrat.x, kvadrat.y, kvadrat.side, kvadrat.side, 0, 0, side, side);

  const webp = await somBlob(canvas, 'image/webp');
  if (webp?.type === 'image/webp') return { blob: webp, type: 'image/webp' };
  const jpeg = await somBlob(canvas, 'image/jpeg');
  if (!jpeg) throw new Error('toBlob');
  return { blob: jpeg, type: 'image/jpeg' };
}
