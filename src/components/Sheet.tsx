import type { ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { t } from '../strings/index.ts';
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
  /** Stays fixed at the bottom, above the home indicator. */
  footer?: ReactNode;
  /** A sheet opened from another sheet sits lower so the one behind shows. */
  stacked?: boolean;
  children: ReactNode;
}

/** The sheet's title, for a custom `header`. */
export const SheetTitle = Dialog.Title;

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
  children,
}: SheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="sheet-scrim" />
        <Dialog.Content
          className={`sheet sheet--${height}${stacked ? ' sheet--stacked' : ''}`}
          /* Radix wires up the Description itself; with none, say so explicitly. */
          {...(description ? {} : { 'aria-describedby': undefined })}
        >
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
                onClick={onLeading ?? (() => onOpenChange(false))}
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
