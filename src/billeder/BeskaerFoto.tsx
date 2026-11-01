import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from 'react';
import { t } from '../strings/index.ts';
import { flyt, MAKS_ZOOM, MIN_ZOOM, synligKvadrat, zoomTil, type Beskaering, type Punkt } from './beskaering.ts';
import type { Foto } from './tegnBillede.ts';
import './BeskaerFoto.css';

/**
 * The round crop: the photo inside a round mask over a square. Drag with one
 * finger (or the mouse), pinch with two, or use the zoom slider. The canvas
 * draws exactly `synligKvadrat`, which is what Gem saves. The maths is in
 * `beskaering.ts`.
 */
export function BeskaerFoto({
  foto,
  beskaering,
  onChange,
}: {
  foto: Foto;
  beskaering: Beskaering;
  onChange: (beskaering: Beskaering) => void;
}) {
  const rude = useRef<HTMLDivElement>(null);
  const laerred = useRef<HTMLCanvasElement>(null);
  const [rudePx, setRudePx] = useState(0);
  /** Fingers down on the crop, by pointer id, in css px from its corner. */
  const fingre = useRef(new Map<number, Punkt>());
  /** The newest crop: several moves can land before the next render. */
  const nu = useRef(beskaering);

  useLayoutEffect(() => {
    nu.current = beskaering;
  }, [beskaering]);

  useEffect(() => {
    const el = rude.current;
    if (!el) return;
    const obs = new ResizeObserver(() => setRudePx(el.clientWidth));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useLayoutEffect(() => {
    const canvas = laerred.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || rudePx === 0) return;
    const px = Math.round(rudePx * (window.devicePixelRatio || 1));
    if (canvas.width !== px) {
      canvas.width = px;
      canvas.height = px;
    }
    const k = synligKvadrat(beskaering, foto);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(foto.kilde, k.x, k.y, k.side, k.side, 0, 0, px, px);
  }, [foto, beskaering, rudePx]);

  function punkt(event: PointerEvent<HTMLDivElement>): Punkt {
    const kasse = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - kasse.left, y: event.clientY - kasse.top };
  }

  /** The first two fingers: a third one does nothing. */
  function toFingre(): Punkt[] {
    return [...fingre.current.values()].slice(0, 2);
  }

  function ned(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    fingre.current.set(event.pointerId, punkt(event));
  }

  function bevaeg(event: PointerEvent<HTMLDivElement>) {
    if (!fingre.current.has(event.pointerId) || rudePx === 0) return;
    const foer = toFingre();
    fingre.current.set(event.pointerId, punkt(event));
    const ny = flyt(nu.current, foto, rudePx, foer, toFingre());
    nu.current = ny;
    onChange(ny);
  }

  function op(event: PointerEvent<HTMLDivElement>) {
    fingre.current.delete(event.pointerId);
  }

  return (
    <div className="beskaer">
      <div
        ref={rude}
        className="beskaer__rude"
        role="img"
        aria-label={t('profilbillede.beskaer')}
        onPointerDown={ned}
        onPointerMove={bevaeg}
        onPointerUp={op}
        onPointerCancel={op}
      >
        <canvas ref={laerred} className="beskaer__laerred" />
        <span className="beskaer__maske" aria-hidden="true" />
      </div>
      <input
        type="range"
        className="beskaer__zoom"
        min={MIN_ZOOM}
        max={MAKS_ZOOM}
        step={0.01}
        value={beskaering.zoom}
        aria-label={t('profilbillede.zoom')}
        onChange={(e) => onChange(zoomTil(nu.current, foto, Number(e.target.value)))}
      />
      <p className="beskaer__hjaelp">{t('profilbillede.beskaerHjaelp')}</p>
    </div>
  );
}
