import { useId, type ReactNode, type Ref } from 'react';
import { Search } from 'lucide-react';
import { fieldKeyboard, type EnterKeyHint, type FieldKind } from './field.ts';
import './Field.css';

interface FieldProps {
  /** The visible label; with `hideLabel`, read by VoiceOver only. */
  label: string;
  hideLabel?: boolean;
  value: string;
  onChange: (value: string) => void;
  /** Picks the keyboard: `integer` (number pad), `decimal` (pad with a comma), `email`, `name`, `date`, `search`. */
  kind?: FieldKind;
  /**
   * `box` (default): label above a rounded box.
   * `amount`: one big centred amount, e.g. "120 kr" in Registrér indbetaling.
   * `row`: label left, value right, for fields stacked in one card.
   */
  variant?: 'box' | 'amount' | 'row';
  /** A unit after the value, e.g. "kr". */
  unit?: string;
  /** What is wrong, shown under the field in red and linked with aria-describedby. Use `visibleError` for typed input. */
  error?: string | null;
  /** The error came from the server: VoiceOver reads it out at once (role="alert"). */
  errorIsAlert?: boolean;
  /** A muted line under the field, also linked with aria-describedby. */
  note?: ReactNode;
  /** The enter key's label. Defaults to the kind's ("done", or "search"). Use "next" when another field follows. */
  enterKeyHint?: EnterKeyHint;
  /** More than one line: a textarea with this many rows (it takes no `ref`). */
  rows?: number;
  /** For a Sheet's `initialFocus`. */
  ref?: Ref<HTMLInputElement>;
  placeholder?: string;
  maxLength?: number;
  autoComplete?: string;
  autoCapitalize?: 'none' | 'sentences' | 'words';
  autoCorrect?: 'on' | 'off';
  spellCheck?: boolean;
  required?: boolean;
  /** `date` only: the earliest date. */
  min?: string;
  /** Ties the field to a form elsewhere in the sheet. */
  form?: string;
  /** On the outer element, for spacing. */
  className?: string;
}

/**
 * The one text field for sheets. It sets the keyboard (`inputMode`,
 * `enterKeyHint`, autocorrect) from `kind`, shows a unit and shows its error
 * and note right under it, linked for VoiceOver. Pair it with `SheetAction`
 * in the footer, which says why the action is off.
 */
export function Field({
  label,
  hideLabel = false,
  value,
  onChange,
  kind = 'text',
  variant = 'box',
  unit,
  error,
  errorIsAlert = false,
  note,
  enterKeyHint,
  rows,
  ref,
  placeholder,
  maxLength,
  autoComplete = 'off',
  autoCapitalize,
  autoCorrect,
  spellCheck,
  required,
  min,
  form,
  className,
}: FieldProps) {
  const id = useId();
  const keyboard = fieldKeyboard(kind);
  const errorId = `${id}-fejl`;
  const noteId = `${id}-note`;
  const describedBy = [error ? errorId : null, note ? noteId : null].filter(Boolean).join(' ') || undefined;

  const shared = {
    className: 'field__input',
    value,
    onChange: (e: { target: { value: string } }) => onChange(e.target.value),
    placeholder,
    maxLength,
    autoComplete,
    autoCapitalize: autoCapitalize ?? keyboard.autoCapitalize,
    autoCorrect: autoCorrect ?? keyboard.autoCorrect,
    spellCheck: spellCheck ?? keyboard.spellCheck,
    enterKeyHint: enterKeyHint ?? keyboard.enterKeyHint,
    required,
    form,
    'aria-label': hideLabel ? label : undefined,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy,
  };

  const control =
    rows !== undefined ? (
      <textarea {...shared} rows={rows} />
    ) : (
      <input
        {...shared}
        ref={ref}
        type={keyboard.type}
        inputMode={kind === 'date' ? undefined : keyboard.inputMode}
        min={min}
        // The amount is as wide as its digits, so "120 kr" stays centred.
        style={variant === 'amount' ? { width: `${Math.max(value.length, 1) + 0.4}ch` } : undefined}
      />
    );

  return (
    <div className={`field field--${variant}${className ? ` ${className}` : ''}`}>
      <label className="field__main">
        {!hideLabel && <span className="field__label">{label}</span>}
        <span className="field__box">
          {kind === 'search' && <Search className="field__icon" size={18} strokeWidth={2} aria-hidden="true" />}
          {control}
          {unit && <span className="field__unit">{unit}</span>}
        </span>
      </label>
      {error && (
        <p id={errorId} className="field__error" role={errorIsAlert ? 'alert' : undefined}>
          {error}
        </p>
      )}
      {note && (
        <p id={noteId} className="field__note">
          {note}
        </p>
      )}
    </div>
  );
}
