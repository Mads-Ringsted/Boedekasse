import { useState } from 'react';
import { Check } from 'lucide-react';
import { Sheet } from '../components/Sheet.tsx';
import { t, type PlainStringId } from '../strings/index.ts';
import { anvendUdseende, gemUdseende, laesUdseende, UDSEENDER, type Udseende } from './udseende.ts';
import './UdseendeSheet.css';

export const UDSEENDE_NAVN: Record<Udseende, PlainStringId> = {
  auto: 'udseende.auto',
  lys: 'udseende.lys',
  moerk: 'udseende.moerk',
};

function lokalLager(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** This device's Udseende, and a setter that saves it and applies it at once. */
export function useUdseende(): [Udseende, (valg: Udseende) => void] {
  const [valg, setValg] = useState<Udseende>(() => {
    const lager = lokalLager();
    return lager ? laesUdseende(lager) : 'auto';
  });
  function vaelg(nyt: Udseende) {
    const lager = lokalLager();
    if (lager) gemUdseende(lager, nyt);
    anvendUdseende(nyt);
    setValg(nyt);
  }
  return [valg, vaelg];
}

interface UdseendeSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  valg: Udseende;
  onVaelg: (valg: Udseende) => void;
}

/** Mere → Udseende: Automatisk, Lys or Mørk. A tap applies it right away. */
export function UdseendeSheet({ open, onOpenChange, valg, onVaelg }: UdseendeSheetProps) {
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      height="partial"
      title={t('udseende.titel')}
      description={t('udseende.beskrivelse')}
    >
      <div className="udseende" role="radiogroup" aria-label={t('udseende.titel')}>
        {UDSEENDER.map((u) => (
          <button
            key={u}
            type="button"
            role="radio"
            aria-checked={u === valg}
            className="udseende__row"
            onClick={() => onVaelg(u)}
          >
            <span className="udseende__tekst">
              <span className="udseende__navn">{t(UDSEENDE_NAVN[u])}</span>
              {u === 'auto' && <span className="udseende__hint">{t('udseende.autoHint')}</span>}
            </span>
            {u === valg && <Check className="udseende__check" size={20} strokeWidth={2.6} aria-hidden="true" />}
          </button>
        ))}
      </div>
    </Sheet>
  );
}
