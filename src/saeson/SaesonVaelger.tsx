import { useState } from 'react';
import { CalendarDays, Check, ChevronDown, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router';
import { Sheet } from '../components/Sheet.tsx';
import { t } from '../strings/index.ts';
import { saesonPeriode, type SaesonPunkt } from './tidligere.ts';
import './Tidligere.css';

interface SaesonVaelgerProps {
  saesoner: SaesonPunkt[];
  /** The Sæson on screen now: ticked in the list. */
  visesId: string;
  /** The button's text, e.g. "Sæson 2026 · Bøder i alt". */
  label: string;
}

/**
 * The Sæson picker: a small button that opens a sheet with every Sæson and
 * its dates. The latest Sæson goes to Hjem; a past one opens its read-only
 * page (`/saeson/:id`).
 */
export function SaesonVaelger({ saesoner, visesId, label }: SaesonVaelgerProps) {
  const [aaben, setAaben] = useState(false);
  const navigate = useNavigate();

  const vaelg = (s: SaesonPunkt) => {
    setAaben(false);
    if (s.id === visesId) return;
    void navigate(s.erSeneste ? '/' : `/saeson/${s.id}`);
  };

  return (
    <>
      <button
        type="button"
        className="saeson-vaelger"
        aria-haspopup="dialog"
        aria-label={`${label}. ${t('saeson.vaelg')}`}
        onClick={() => setAaben(true)}
      >
        {label}
        <ChevronDown size={14} strokeWidth={2.4} aria-hidden="true" />
      </button>
      <Sheet open={aaben} onOpenChange={setAaben} height="partial" title={t('saeson.vaelgTitel')}>
        <ul className="saeson-liste">
          {saesoner.map((s) => {
            const vises = s.id === visesId;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  className="saeson-liste__row"
                  onClick={() => vaelg(s)}
                  aria-current={vises ? 'true' : undefined}
                >
                  <span className={`saeson-liste__ikon${s.erSeneste ? ' saeson-liste__ikon--seneste' : ''}`} aria-hidden="true">
                    <CalendarDays size={20} strokeWidth={2} />
                  </span>
                  <span className="saeson-liste__tekst">
                    <span className="saeson-liste__navn">{s.navn}</span>
                    <span className="saeson-liste__periode">{saesonPeriode(s)}</span>
                  </span>
                  {vises ? (
                    <Check className="saeson-liste__check" size={20} strokeWidth={2.6} aria-label={t('saeson.vises')} />
                  ) : (
                    <ChevronRight className="saeson-liste__chevron" size={18} strokeWidth={2.2} aria-hidden="true" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </Sheet>
    </>
  );
}
