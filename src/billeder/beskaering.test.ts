import { describe, expect, it } from 'vitest';
import { flyt, MAKS_ZOOM, startBeskaering, synligKvadrat, udSide, zoomTil } from './beskaering.ts';

const liggende = { bredde: 4000, hoejde: 3000 };
const staaende = { bredde: 1080, hoejde: 1920 };

describe('startBeskaering: the crop when a photo is picked', () => {
  it('shows the centre of a landscape photo, cutting the sides off', () => {
    expect(synligKvadrat(startBeskaering(liggende), liggende)).toEqual({ x: 500, y: 0, side: 3000 });
  });

  it('shows the centre of a portrait photo, cutting the top and bottom off', () => {
    expect(synligKvadrat(startBeskaering(staaende), staaende)).toEqual({ x: 0, y: 420, side: 1080 });
  });

  it('keeps a square photo whole', () => {
    const foto = { bredde: 800, hoejde: 800 };
    expect(synligKvadrat(startBeskaering(foto), foto)).toEqual({ x: 0, y: 0, side: 800 });
  });
});

describe('zoomTil: the zoom slider', () => {
  it('zooms in around the middle of the circle', () => {
    const b = zoomTil(startBeskaering(liggende), liggende, 2);
    expect(synligKvadrat(b, liggende)).toEqual({ x: 1250, y: 750, side: 1500 });
  });

  it('never zooms out past filling the circle', () => {
    const b = zoomTil(startBeskaering(liggende), liggende, 0.5);
    expect(synligKvadrat(b, liggende)).toEqual({ x: 500, y: 0, side: 3000 });
  });

  it('stops at 4× zoom', () => {
    const b = zoomTil(startBeskaering(liggende), liggende, 10);
    expect(b.zoom).toBe(MAKS_ZOOM);
    expect(synligKvadrat(b, liggende).side).toBe(750);
  });

  it('zooming out near an edge pulls the photo back over the circle', () => {
    // Zoomed in on the top-left corner, then all the way out.
    const hjoerne = { cx: 375, cy: 375, zoom: 4 };
    const b = zoomTil(hjoerne, liggende, 1);
    expect(synligKvadrat(b, liggende)).toEqual({ x: 0, y: 0, side: 3000 });
  });
});

// The crop circle on screen is 300 css px across.
const RUDE = 300;

describe('flyt: dragging with one finger', () => {
  it('moves the photo with the finger', () => {
    // 1080 source px fill 300 css px: 100 css px down is 360 source px.
    const b = flyt(startBeskaering(staaende), staaende, RUDE, [{ x: 150, y: 100 }], [{ x: 150, y: 200 }]);
    expect(synligKvadrat(b, staaende)).toEqual({ x: 0, y: 60, side: 1080 });
  });

  it('moves half as far in the photo when zoomed in 2×', () => {
    const zoomet = zoomTil(startBeskaering(staaende), staaende, 2);
    const b = flyt(zoomet, staaende, RUDE, [{ x: 150, y: 100 }], [{ x: 150, y: 200 }]);
    expect(synligKvadrat(b, staaende)).toEqual({ x: 270, y: 510, side: 540 });
  });

  it('stops at the edge of the photo, so the circle stays covered', () => {
    const b = flyt(startBeskaering(staaende), staaende, RUDE, [{ x: 150, y: 0 }], [{ x: 400, y: 900 }]);
    expect(synligKvadrat(b, staaende)).toEqual({ x: 0, y: 0, side: 1080 });
  });
});

describe('flyt: pinching with two fingers', () => {
  it('zooms around the point between the fingers, which stays under them', () => {
    // At 1×, (75, 75) on screen is (1250, 750) in the photo. Fingers spread from 50 to 100 px apart.
    const foer = [{ x: 50, y: 75 }, { x: 100, y: 75 }];
    const efter = [{ x: 25, y: 75 }, { x: 125, y: 75 }];
    const b = flyt(startBeskaering(liggende), liggende, RUDE, foer, efter);
    // At 2×, 1500 source px fill 300 css px; 75 css px in is 375 source px, so (1250, 750) is still under (75, 75).
    expect(synligKvadrat(b, liggende)).toEqual({ x: 875, y: 375, side: 1500 });
  });

  it('pinching in past filling the circle stops at 1×, still covering it', () => {
    const zoomet = { cx: 400, cy: 400, zoom: 4 };
    const foer = [{ x: 0, y: 0 }, { x: 300, y: 300 }];
    const efter = [{ x: 140, y: 140 }, { x: 160, y: 160 }];
    const b = flyt(zoomet, liggende, RUDE, foer, efter);
    expect(synligKvadrat(b, liggende)).toEqual({ x: 0, y: 0, side: 3000 });
  });

  it('ignores a step where a finger was added or lifted', () => {
    const start = startBeskaering(liggende);
    expect(flyt(start, liggende, RUDE, [{ x: 0, y: 0 }], [{ x: 10, y: 0 }, { x: 90, y: 0 }])).toEqual(start);
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
