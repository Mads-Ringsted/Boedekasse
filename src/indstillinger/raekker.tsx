import { Children, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import type { RegelStatus } from './regel.ts';
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
  /** Small, under the label. */
  under?: string;
  /** Muted, before the chevron. */
  vaerdi?: string;
  /**
   * A rule's status instead of `vaerdi` (#94): "Til · 300 kr", or a fainter
   * "Fra". Build it with the rule's helper (see `regler.ts`).
   */
  status?: RegelStatus;
  onClick: () => void;
  /** `handling`: a blue action row with no chevron; `fare`: red. */
  art?: 'link' | 'handling' | 'fare';
}

/** A row that opens something: a sheet or a screen. A rule row opens the rule's sheet, where its switch lives. */
export function LinkRaekke({ label, under, vaerdi, status, onClick, art = 'link' }: LinkRaekkeProps) {
  const vist = vaerdi ?? status?.tekst;
  return (
    <button type="button" className={`indst-raekke indst-raekke--${art}`} onClick={onClick}>
      {under ? (
        <span className="indst-raekke__tekst">
          <span className="indst-raekke__label">{label}</span>
          <span className="indst-raekke__under">{under}</span>
        </span>
      ) : (
        <span className="indst-raekke__label">{label}</span>
      )}
      {vist !== undefined && (
        <span className={`indst-raekke__vaerdi${status && !status.til ? ' indst-raekke__vaerdi--fra' : ''}`}>
          {vist}
        </span>
      )}
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
      <Switch label={label} til={til} onSkift={onSkift} disabled={disabled} />
    </div>
  );
}

interface SwitchProps {
  /** Read by VoiceOver; the visible label sits next to it. */
  label: string;
  til: boolean;
  onSkift: (til: boolean) => void;
  /** Off while a change is being saved, so a double tap sends one. */
  disabled?: boolean;
  /** The id of an error that explains the switch. */
  describedBy?: string;
}

/** The on/off switch of settings rows and rule sheets. */
export function Switch({ label, til, onSkift, disabled = false, describedBy }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={til}
      aria-label={label}
      aria-describedby={describedBy}
      className="indst-switch"
      disabled={disabled}
      onClick={() => onSkift(!til)}
    >
      <span className="indst-switch__knop" />
    </button>
  );
}
