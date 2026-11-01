import { useRef, useState, type FormEvent } from 'react';
import { Field } from '../components/Field.tsx';
import { primaryAction } from '../components/field.ts';
import { Sheet } from '../components/Sheet.tsx';
import { SheetAction } from '../components/SheetAction.tsx';
import { t } from '../strings/index.ts';
import { rpcErrorText } from '../supabase/rpcErrors.ts';
import './felter.css';
import './AdminHandlinger.css';

/** An RPC call with the sheet's one-time ID; resolves to supabase-js's `{ error }`. */
type Kald<A extends unknown[] = []> = (klientId: string, ...args: A) => PromiseLike<{ error: unknown }>;

const FORM_ID = 'ret-felt';

interface BekraeftSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titel: string;
  tekst: string;
  knap: string;
  /** Red button (Meld ud, Slet). */
  farlig?: boolean;
  kald: Kald;
  onFaerdig: () => void;
}

/**
 * Confirm one Admin action: a short text and one button. Mount with a fresh
 * `key` per opening, so the one-time ID is new.
 */
export function BekraeftSheet({ open, onOpenChange, titel, tekst, knap, farlig = false, kald, onFaerdig }: BekraeftSheetProps) {
  const [klientId] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [fejl, setFejl] = useState<string | null>(null);

  async function bekraeft() {
    setBusy(true);
    setFejl(null);
    const { error } = await kald(klientId);
    setBusy(false);
    if (error) {
      setFejl(rpcErrorText(error));
      return;
    }
    onFaerdig();
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      height="partial"
      title={titel}
      footer={
        <button
          type="button"
          className={`felt-knap${farlig ? ' felt-knap--farlig' : ''}`}
          disabled={busy}
          onClick={() => void bekraeft()}
        >
          {knap}
        </button>
      }
    >
      <p className="felt-note">{tekst}</p>
      {fejl && (
        <p className="felt-fejl" role="alert">
          {fejl}
        </p>
      )}
    </Sheet>
  );
}

interface RetFeltSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titel: string;
  label: string;
  type: 'text' | 'email';
  start: string;
  note?: string;
  kald: Kald<[vaerdi: string]>;
  onFaerdig: () => void;
}

/** One text field and Gem (Ret navn, Ret email). Mount with a fresh `key` per opening. */
export function RetFeltSheet({ open, onOpenChange, titel, label, type, start, note, kald, onFaerdig }: RetFeltSheetProps) {
  const [klientId] = useState(() => crypto.randomUUID());
  const [vaerdi, setVaerdi] = useState(start);
  const [busy, setBusy] = useState(false);
  const [fejl, setFejl] = useState<string | null>(null);
  const felt = useRef<HTMLInputElement>(null);
  const handling = primaryAction([[vaerdi.trim() !== '', t(type === 'email' ? 'aarsag.skrivEmail' : 'aarsag.skrivNavn')]], {
    busy,
    unchanged: vaerdi.trim() === start,
  });
  const kanGemme = handling.enabled;

  async function gem(event: FormEvent) {
    event.preventDefault();
    if (!kanGemme) return;
    setBusy(true);
    setFejl(null);
    const { error } = await kald(klientId, vaerdi);
    setBusy(false);
    if (error) {
      setFejl(rpcErrorText(error));
      return;
    }
    onFaerdig();
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      height="partial"
      title={titel}
      initialFocus={felt}
      dirty={vaerdi !== start}
      footer={
        <SheetAction form={FORM_ID} disabled={!kanGemme} reason={handling.reason} error={fejl}>
          {t('adminHandlinger.gem')}
        </SheetAction>
      }
    >
      <form id={FORM_ID} onSubmit={(e) => void gem(e)}>
        <Field
          ref={felt}
          label={label}
          kind={type === 'email' ? 'email' : 'name'}
          value={vaerdi}
          onChange={setVaerdi}
          note={note}
        />
      </form>
    </Sheet>
  );
}
