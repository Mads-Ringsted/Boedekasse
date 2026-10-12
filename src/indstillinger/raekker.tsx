import { Children, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import './Indstillinger.css';

/** A titled card of rows. Hidden while it has no rows. */
export function Gruppe({ titel, children }: { titel?: string; children?: ReactNode }) {
  if (Children.toArray(children).length === 0) return null;
  return (
    <section className="indst-gruppe">
      {titel && <h2 className="indst-gruppe__titel">{titel}</h2>}
      <div className="indst-gruppe__kort">{children}</div>
    </section>
  );
}

interface LinkRaekkeProps {
  label: string;
  /** Muted, before the chevron. */
  vaerdi?: string;
  onClick: () => void;
  /** `handling`: a blue action row with no chevron; `fare`: red. */
  art?: 'link' | 'handling' | 'fare';
}

/** A row that opens something: a sheet or a screen. */
export function LinkRaekke({ label, vaerdi, onClick, art = 'link' }: LinkRaekkeProps) {
  return (
    <button type="button" className={`indst-raekke indst-raekke--${art}`} onClick={onClick}>
      <span className="indst-raekke__label">{label}</span>
      {vaerdi !== undefined && <span className="indst-raekke__vaerdi">{vaerdi}</span>}
      {art === 'link' && (
        <ChevronRight className="indst-raekke__chevron" size={16} strokeWidth={2.2} aria-hidden="true" />
      )}
    </button>
  );
}

interface SwitchRaekkeProps {
  label: string;
  /** Small, under the label: the rule's amount or window. */
  under?: string;
  til: boolean;
  onSkift: (til: boolean) => void;
  /** Tapping the text opens the rule's details (amount etc.). */
  onAabn?: () => void;
  disabled?: boolean;
}

/** A Særlig regel: on/off, with its amount under the name. */
export function SwitchRaekke({ label, under, til, onSkift, onAabn, disabled = false }: SwitchRaekkeProps) {
  const tekst = (
    <>
      <span className="indst-raekke__label">{label}</span>
      {under && <span className="indst-raekke__under">{under}</span>}
    </>
  );
  return (
    <div className="indst-raekke indst-raekke--switch">
      {onAabn ? (
        <button type="button" className="indst-raekke__tekst" onClick={onAabn}>
          {tekst}
        </button>
      ) : (
        <span className="indst-raekke__tekst">{tekst}</span>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={til}
        aria-label={label}
        className="indst-switch"
        disabled={disabled}
        onClick={() => onSkift(!til)}
      >
        <span className="indst-switch__knop" />
      </button>
    </div>
  );
}
