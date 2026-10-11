import { useState, type FormEvent } from 'react';
import { Sheet } from '../components/Sheet.tsx';
import { t } from '../strings/index.ts';
import { rpcErrorText } from '../supabase/rpcErrors.ts';
import './felter.css';
import './AdminHandlinger.css';

/** An RPC call with the sheet's one-time ID; resolves to supabase-js's `{ error }`. */
type Kald<A extends unknown[] = []> = (klientId: string, ...args: A) => PromiseLike<{ error: unknown }>;

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
    <Sheet open={open} onOpenChange={onOpenChange} height="partial" title={titel}>
      <p className="felt-note">{tekst}</p>
      {fejl && (
        <p className="felt-fejl" role="alert">
          {fejl}
        </p>
      )}
      <button
        type="button"
        className={`felt-knap felt-knap--naer${farlig ? ' felt-knap--farlig' : ''}`}
        disabled={busy}
        onClick={() => void bekraeft()}
      >
        {knap}
      </button>
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
  const kanGemme = vaerdi.trim() !== '' && vaerdi.trim() !== start && !busy;

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
    <Sheet open={open} onOpenChange={onOpenChange} height="partial" title={titel}>
      <form onSubmit={(e) => void gem(e)}>
        <label className="felt">
          <span className="felt__label">{label}</span>
          <input
            className="felt__input"
            type={type}
            value={vaerdi}
            onChange={(e) => setVaerdi(e.target.value)}
            autoComplete="off"
            autoCapitalize={type === 'email' ? 'none' : 'words'}
            inputMode={type === 'email' ? 'email' : 'text'}
            enterKeyHint="done"
          />
        </label>
        {note && <p className="felt-note">{note}</p>}
        {fejl && (
          <p className="felt-fejl" role="alert">
            {fejl}
          </p>
        )}
        <button type="submit" className="felt-knap felt-knap--naer" disabled={!kanGemme}>
          {t('adminHandlinger.gem')}
        </button>
      </form>
    </Sheet>
  );
}
