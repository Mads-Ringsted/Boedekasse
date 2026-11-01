import { useId, type ReactNode } from 'react';
import './SheetAction.css';

interface SheetActionProps {
  /** The button's text, e.g. "Gem". */
  children: ReactNode;
  /** Submits the form with this id (the form stays in the sheet body). */
  form?: string;
  /** Without `form`: what the button does. */
  onClick?: () => void;
  disabled?: boolean;
  /** Why it is off, shown above the button. Get it from `primaryAction`. */
  reason?: string | null;
  /** The server's answer after a failed save, shown above the button. */
  error?: string | null;
  /** The button's class. Defaults to the plain "felt-knap". */
  className?: string;
}

/**
 * A sheet's primary action for the `footer`: the button, why it is off, and
 * the error from the last try, right above it so they show above the
 * keyboard too.
 */
export function SheetAction({
  children,
  form,
  onClick,
  disabled = false,
  reason,
  error,
  className = 'felt-knap',
}: SheetActionProps) {
  const id = useId();
  const reasonId = `${id}-aarsag`;
  const showReason = disabled && reason;

  return (
    <div className="sheet-action">
      {error && (
        <p className="sheet-action__error" role="alert">
          {error}
        </p>
      )}
      {showReason && (
        <p id={reasonId} className="sheet-action__reason">
          {reason}
        </p>
      )}
      <button
        type={form ? 'submit' : 'button'}
        form={form}
        onClick={onClick}
        className={className}
        disabled={disabled}
        aria-describedby={showReason ? reasonId : undefined}
      >
        {children}
      </button>
    </div>
  );
}
