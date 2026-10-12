import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { formatKr, t } from '../strings/index.ts';
import { supabase } from '../supabase/index.ts';
import { rpcErrorText } from '../supabase/rpcErrors.ts';
import type { Givet } from './GivBoeder.tsx';
import { boederTekst } from './tekst.ts';

/** How long Fortryd is offered. The server allows a little more (private.fortryd_frist). */
const VIS_MS = 8000;
/** How long a message after tapping Fortryd stays. */
const BESKED_MS = 3000;

type Tilstand = { slags: 'vis' } | { slags: 'fortryder' } | { slags: 'besked'; tekst: string };

interface FortrydToastProps {
  givet: Givet;
  /** Time is up, or the message has been read. */
  onLuk: () => void;
  /** The batch is gone; screens should reload. */
  onFortrudt: () => void;
}

/** "5 bøder givet · 210 kr" with Fortryd and a bar counting down ~8 seconds. */
export function FortrydToast({ givet, onLuk, onFortrudt }: FortrydToastProps) {
  const [tilstand, setTilstand] = useState<Tilstand>({ slags: 'vis' });
  const [klientId] = useState(() => crypto.randomUUID());
  // A new onLuk from a parent re-render must not restart the countdown.
  const lukRef = useRef(onLuk);
  lukRef.current = onLuk;

  useEffect(() => {
    if (tilstand.slags === 'fortryder') return;
    const id = setTimeout(() => lukRef.current(), tilstand.slags === 'vis' ? VIS_MS : BESKED_MS);
    return () => clearTimeout(id);
  }, [tilstand]);

  async function fortryd() {
    setTilstand({ slags: 'fortryder' });
    const { error } = await supabase.rpc('fortryd_batch', { p_klient_id: klientId, p_batch: givet.batchId });
    if (error) {
      setTilstand({ slags: 'besked', tekst: rpcErrorText(error) });
      return;
    }
    onFortrudt();
    setTilstand({ slags: 'besked', tekst: t('giv.fortrudt') });
  }

  return (
    <div className="fortryd" role="status">
      <div className="fortryd__indhold">
        {tilstand.slags === 'besked' ? (
          <span className="fortryd__tekst">{tilstand.tekst}</span>
        ) : (
          <>
            <span className="fortryd__flueben" aria-hidden="true">
              <Check size={14} strokeWidth={3} />
            </span>
            <span className="fortryd__tekst">
              {t('giv.givet', { boeder: boederTekst(givet.antal), beloeb: formatKr(givet.beloeb) })}
            </span>
            <button
              type="button"
              className="fortryd__knap"
              disabled={tilstand.slags === 'fortryder'}
              onClick={() => void fortryd()}
            >
              {t('giv.fortryd')}
            </button>
          </>
        )}
      </div>
      {tilstand.slags === 'vis' && (
        <div className="fortryd__spor" aria-hidden="true">
          <div className="fortryd__bar" style={{ animationDuration: `${VIS_MS}ms` }} />
        </div>
      )}
    </div>
  );
}
