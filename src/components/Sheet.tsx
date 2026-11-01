import { useCallback, useId, useState, type ReactNode, type RefObject } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { t } from '../strings/index.ts';
import { isTextField, revealFocusedField, useKeyboardInset } from './useKeyboardInset.ts';
import './Sheet.css';

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * `full` for flows (Giv bøder, Ny Konkurrence, Registrér indbetaling,
   * Anke): Annullér/Tilbage on the left, centred title, fixed footer.
   * `partial` for quick views (Bøde detail, Betal, Anke verdict, Admin
   * actions): grabber, title and a close (X) button.
   */
  height: 'full' | 'partial';
  title: string;
  /** Read by VoiceOver only, when the sheet has no visible intro text. */
  description?: string;
  /** Full sheets: the left button's content. Defaults to "Annullér". */
  leadingLabel?: ReactNode;
  /** Full sheets: what the left button does. Defaults to closing. */
  onLeading?: () => void;
  /** Full sheets: the right side of the header (e.g. Giv bøder's "1 af 3"). */
  trailing?: ReactNode;
  /** Stays fixed under the header, above the part that scrolls. */
  top?: ReactNode;
  /**
   * Replaces the default header entirely (Giv step 3b). Put a <SheetTitle>
   * in it; `title` is then only the fallback for VoiceOver.
   */
  header?: ReactNode;
  /**
   * Stays fixed at the bottom, above the home indicator or the keyboard. Put
   * the primary action (Gem, Opret …) here, in partial sheets too. A submit
   * button reaches a form in the body with `form={FORM_ID}`.
   */
  footer?: ReactNode;
  /**
   * The field to focus when the sheet opens, so the keyboard opens with it.
   * Focus moves without scrolling, so nothing jumps. Leave it out to focus
   * the sheet's first button, as before.
   */
  initialFocus?: RefObject<HTMLElement | null>;
  /**
   * There is unsaved input: Annullér, X, Escape and a tap outside ask before
   * the sheet closes. Closing from your own code (after Gem) never asks.
   */
  dirty?: boolean;
  /** A sheet opened from another sheet sits lower so the one behind shows. */
  stacked?: boolean;
  children: ReactNode;
}

/** The sheet's title, for a custom `header`. */
export const SheetTitle = Dialog.Title;

/** A button that closes the sheet, for a custom `header`. */
export const SheetClose = Dialog.Close;

/** The one shared bottom sheet. Built on Radix Dialog for focus and Escape. */
export function Sheet({
  open,
  onOpenChange,
  height,
  title,
  description,
  leadingLabel,
  onLeading,
  trailing,
  top,
  header,
  footer,
  stacked = false,
  initialFocus,
  dirty = false,
  children,
}: SheetProps) {
  // A state, not a ref: Radix mounts the content one render after `open`.
  const [sheet, setSheet] = useState<HTMLDivElement | null>(null);
  useKeyboardInset(sheet);

  const [asking, setAsking] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    setAsking(false);
  }

  /** Every close the user starts goes through here; with unsaved input, ask first. */
  function requestOpenChange(next: boolean) {
    if (!next && dirty) setAsking(true);
    else onOpenChange(next);
  }

  return (
    <Dialog.Root open={open} onOpenChange={requestOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="sheet-scrim" />
        <Dialog.Content
          ref={setSheet}
          className={`sheet sheet--${height}${stacked ? ' sheet--stacked' : ''}`}
          /* Radix wires up the Description itself; with none, say so explicitly. */
          {...(description ? {} : { 'aria-describedby': undefined })}
          onOpenAutoFocus={(event) => {
            const field = initialFocus?.current;
            if (!field) return;
            // Still inside the tap that opened the sheet, so iOS opens the keyboard.
            event.preventDefault();
            field.focus({ preventScroll: true });
          }}
          onPointerDownOutside={(event) => {
            // A tap above the sheet hides the keyboard first, and keeps what was typed.
            const focused = document.activeElement;
            if (isTextField(focused) && sheet?.contains(focused)) {
              event.preventDefault();
              focused.blur();
            }
          }}
          onEscapeKeyDown={(event) => {
            if (asking) {
              event.preventDefault();
              setAsking(false);
            }
          }}
          onFocus={() => {
            // Moving between fields with the keyboard up: keep the new one in view.
            if (sheet?.dataset.keyboard === 'open') revealFocusedField(sheet);
          }}
        >
          {/* First, so the body stays the last child; it is drawn over the bottom. */}
          {asking && (
            <CloseWithoutSaving
              onStay={() => setAsking(false)}
              onClose={() => {
                setAsking(false);
                onOpenChange(false);
              }}
            />
          )}
          {header ? (
            <>
              <span className="sheet__grabber" aria-hidden="true" />
              {header}
            </>
          ) : height === 'full' ? (
            <header className="sheet__header sheet__header--full">
              <button
                type="button"
                className="sheet__leading"
                onClick={onLeading ?? (() => requestOpenChange(false))}
              >
                {leadingLabel ?? t('sheet.annuller')}
              </button>
              <Dialog.Title className="sheet__title">{title}</Dialog.Title>
              {trailing ? (
                <span className="sheet__trailing">{trailing}</span>
              ) : (
                <span className="sheet__spacer" aria-hidden="true" />
              )}
            </header>
          ) : (
            <>
              <span className="sheet__grabber" aria-hidden="true" />
              <header className="sheet__header sheet__header--partial">
                <Dialog.Title className="sheet__title">{title}</Dialog.Title>
                <Dialog.Close className="sheet__close" aria-label={t('sheet.luk')}>
                  <X size={18} strokeWidth={2.4} />
                </Dialog.Close>
              </header>
            </>
          )}
          {description && (
            <Dialog.Description className="visually-hidden">{description}</Dialog.Description>
          )}
          {top}
          <div className="sheet__body">{children}</div>
          {footer && <footer className="sheet__footer">{footer}</footer>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** "Luk uden at gemme?" over the bottom of a sheet with unsaved input. */
function CloseWithoutSaving({ onStay, onClose }: { onStay: () => void; onClose: () => void }) {
  const id = useId();
  const focusStay = useCallback((button: HTMLButtonElement | null) => button?.focus({ preventScroll: true }), []);
  return (
    <div className="sheet__ask" role="alertdialog" aria-labelledby={id}>
      <p id={id} className="sheet__ask-title">
        {t('sheet.kasserTitel')}
      </p>
      <div className="sheet__ask-buttons">
        <button type="button" ref={focusStay} className="sheet__ask-stay" onClick={onStay}>
          {t('sheet.fortsaet')}
        </button>
        <button type="button" className="sheet__ask-close" onClick={onClose}>
          {t('sheet.kasser')}
        </button>
      </div>
    </div>
  );
}
