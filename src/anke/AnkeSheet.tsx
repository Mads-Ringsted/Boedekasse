import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeftRight, CircleDollarSign, Users } from 'lucide-react';
import type { Boede } from '../aktivitet/haendelse.ts';
import { siden } from '../aktivitet/tid.ts';
import { Avatar } from '../components/Avatar.tsx';
import { Sheet, SheetTitle } from '../components/Sheet.tsx';
import { kortNavne } from '../giv/navne.ts';
import { formatKr, t } from '../strings/index.ts';
import { supabase } from '../supabase/index.ts';
import { rpcErrorText } from '../supabase/rpcErrors.ts';
import { gebyrInterval, kronerUdenKr as tal, type AnkeRegler } from './anke.ts';
import '../medlemmer/felter.css';
import './Anke.css';


interface Svar {
  gebyr: number;
  min: number;
  max: number;
}

interface AnkeSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boede: Boede;
  regler: AnkeRegler;
  /** Opened from another sheet (the Bøde detail). */
  stacked?: boolean;
  /** The Anke was filed; called when the sheet closes (reload what shows the Bøde). */
  onSendt: () => void;
}

/**
 * Anke (full sheet): the intro (anke-intro.html), then "Anke og drej hjulet"
 * files the Anke and the wheel spins to the Gebyr the server drew
 * (anke-hjul.html). There is no cancel once filed. Mount with a fresh `key`
 * per opening so the one-time ID is new.
 */
export function AnkeSheet({ open, onOpenChange, boede, regler, stacked = false, onSendt }: AnkeSheetProps) {
  const [klientId] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [fejl, setFejl] = useState<string | null>(null);
  const [svar, setSvar] = useState<Svar | null>(null);
  const [landet, setLandet] = useState(false);
  const land = useCallback(() => setLandet(true), []);

  const giver = kortNavne([boede.giverNavn])[0] ?? boede.giverNavn;
  const interval = gebyrInterval(boede.pris, regler);

  function luk(aaben: boolean) {
    onOpenChange(aaben);
    if (!aaben && svar) onSendt();
  }

  async function anke() {
    if (busy) return;
    setBusy(true);
    setFejl(null);
    const { data, error } = await supabase.rpc('indgiv_anke', { p_klient_id: klientId, p_bode: boede.id });
    setBusy(false);
    if (error) {
      setFejl(rpcErrorText(error));
      return;
    }
    const s = data as Partial<Svar> | null;
    setSvar({ gebyr: s?.gebyr ?? 0, min: s?.min ?? interval.min, max: s?.max ?? interval.max });
  }

  if (svar) {
    return (
      <Sheet
        open={open}
        onOpenChange={luk}
        height="full"
        stacked={stacked}
        title={t('anke.hjulTitel', { navn: boede.navn })}
        header={
          <header className="sheet__header sheet__header--full">
            <span />
            <SheetTitle className="sheet__title">{t('anke.hjulTitel', { navn: boede.navn })}</SheetTitle>
            <span />
          </header>
        }
        footer={
          landet ? (
            <button type="button" className="felt-knap" onClick={() => luk(false)}>
              {t('anke.faerdig')}
            </button>
          ) : undefined
        }
      >
        <div className="anke-hjul">
          <Hjul svar={svar} landet={landet} onLandet={land} />
          <div className={`anke-hjul__besked${landet ? ' anke-hjul__besked--vist' : ''}`} aria-live="polite">
            {landet && (
              <>
                <span className="anke-hjul__sendt">{t('anke.sendt')}</span>
                <span className="anke-hjul__tekst">{t('anke.sendtTekst', { beloeb: formatKr(svar.gebyr) })}</span>
              </>
            )}
          </div>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet
      open={open}
      onOpenChange={luk}
      height="full"
      stacked={stacked}
      title={t('anke.ankeBoeden')}
      footer={
        <>
          {fejl && (
            <p className="felt-fejl anke__fejl" role="alert">
              {fejl}
            </p>
          )}
          <button type="button" className="felt-knap" disabled={busy} onClick={() => void anke()}>
            {t('anke.drej')}
          </button>
        </>
      }
    >
      <div className="anke-boede">
        <Avatar navn={boede.giverNavn} size={40} />
        <span className="anke-boede__tekst">
          <span className="anke-boede__navn">{boede.navn}</span>
          <span className="anke-boede__fra">{t('anke.fra', { giver, siden: siden(boede.givet) })}</span>
        </span>
        <span className="anke-boede__beloeb">{formatKr(boede.pris)}</span>
      </div>

      <ul className="anke-punkter">
        <Punkt Icon={CircleDollarSign} titel={t('anke.punkt1Titel')}>
          {t('anke.punkt1', { min: tal(interval.min), max: formatKr(interval.max) })}
        </Punkt>
        <Punkt Icon={Users} titel={t('anke.punkt2Titel')}>
          {t('anke.punkt2', { giver })}
        </Punkt>
        <Punkt Icon={ArrowLeftRight} titel={t('anke.punkt3Titel')}>
          {t('anke.punkt3', { giver, pris: formatKr(boede.pris) })}
        </Punkt>
      </ul>
    </Sheet>
  );
}

function Punkt({
  Icon,
  titel,
  children,
}: {
  Icon: typeof Users;
  titel: string;
  children: string;
}) {
  return (
    <li className="anke-punkt">
      <span className="anke-punkt__ikon" aria-hidden="true">
        <Icon size={18} strokeWidth={2} />
      </span>
      <span className="anke-punkt__tekst">
        <span className="anke-punkt__titel">{titel}</span>
        <span className="anke-punkt__under">{children}</span>
      </span>
    </li>
  );
}

const SEGMENTER = 20;
const GRADER = 360 / SEGMENTER;
const OMGANGE = 6;
const VARIGHED_MS = 3400;

/**
 * The wheel: a segmented ring that spins (ease-out) and lands with one
 * segment under the pointer, which turns blue; then the Gebyr shows in the
 * centre. Motion only: the amount came from the server. Lands at once when
 * the person prefers reduced motion.
 */
function Hjul({ svar, landet, onLandet }: { svar: Svar; landet: boolean; onLandet: () => void }) {
  const spaend = svar.max - svar.min;
  const segment = spaend > 0 ? Math.round(((svar.gebyr - svar.min) / spaend) * (SEGMENTER - 1)) : 0;
  const slut = OMGANGE * 360 - segment * GRADER;
  const [rotation, setRotation] = useState(0);
  const landetRef = useRef(false);

  useEffect(() => {
    const land = () => {
      if (landetRef.current) return;
      landetRef.current = true;
      onLandet();
    };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setRotation(slut);
      land();
      return;
    }
    // Start on the next frame so the transition runs from 0.
    const ramme = requestAnimationFrame(() => setRotation(slut));
    // In case transitionend never comes (tab hidden mid-spin).
    const timer = window.setTimeout(land, VARIGHED_MS + 300);
    return () => {
      cancelAnimationFrame(ramme);
      window.clearTimeout(timer);
    };
  }, [slut, onLandet]);

  const beloeb = formatKr(svar.gebyr);
  return (
    <div
      className="anke-hjul__hjul"
      role="img"
      aria-label={landet ? t('anke.hjuletLandede', { beloeb }) : t('anke.hjuletDrejer')}
    >
      <span
        className="anke-hjul__ring"
        aria-hidden="true"
        style={{ transform: `rotate(${rotation}deg)`, transitionDuration: `${VARIGHED_MS}ms` }}
        onTransitionEnd={() => {
          if (!landetRef.current) {
            landetRef.current = true;
            onLandet();
          }
        }}
      >
        <span
          className={`anke-hjul__valgt${landet ? ' anke-hjul__valgt--vist' : ''}`}
          style={{ transform: `rotate(${segment * GRADER}deg)` }}
        />
      </span>
      <span className="anke-hjul__pil" aria-hidden="true" />
      <span className="anke-hjul__midte">
        <span className="anke-hjul__label">{t('anke.ankegebyr')}</span>
        <span className="anke-hjul__beloeb">{landet ? beloeb : '…'}</span>
        <span className="anke-hjul__af">{t('anke.af', { min: tal(svar.min), max: formatKr(svar.max) })}</span>
      </span>
    </div>
  );
}
