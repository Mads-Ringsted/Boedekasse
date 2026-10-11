import { useState, type FormEvent } from 'react';
import { Sheet } from '../components/Sheet.tsx';
import { t } from '../strings/index.ts';
import { rpcErrorText } from '../supabase/rpcErrors.ts';
import '../medlemmer/felter.css';
import './Indstillinger.css';

/** Turns the typed text into the value to save, or a Danish error. */
export type Tjek<V> = (tekst: string) => { ok: true; vaerdi: V } | { ok: false; fejl: string };

export interface RetIndstillingSheetProps<V> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  label: string;
  /** The field's starting text. */
  start: string;
  tjek: Tjek<V>;
  /** Saves; throws the RPC error. Gets one one-time ID per opening. */
  onGem: (vaerdi: V, klientId: string) => Promise<void>;
  /** Shown after the field, e.g. "kr". */
  enhed?: string;
  inputMode?: 'text' | 'numeric';
  note?: string;
}

/** Everything but open/close: what a row passes to open the sheet. */
export type RetIndhold<V> = Omit<RetIndstillingSheetProps<V>, 'open' | 'onOpenChange'>;

/**
 * One setting in a partial sheet: a field, an optional note and Gem.
 * Use it for every typed setting (name, number, amount). Mount it with a new
 * `key` per opening so the field and the one-time ID start fresh.
 */
export function RetIndstillingSheet<V>({
  open,
  onOpenChange,
  title,
  label,
  start,
  tjek,
  onGem,
  enhed,
  inputMode = 'text',
  note,
}: RetIndstillingSheetProps<V>) {
  const [tekst, setTekst] = useState(start);
  const [busy, setBusy] = useState(false);
  const [fejl, setFejl] = useState<string | null>(null);
  const [klientId] = useState(() => crypto.randomUUID());

  const resultat = tjek(tekst);
  const kanGemme = resultat.ok && tekst !== start && !busy;

  async function gem(event: FormEvent) {
    event.preventDefault();
    if (!kanGemme || !resultat.ok) return;
    setBusy(true);
    setFejl(null);
    try {
      await onGem(resultat.vaerdi, klientId);
      onOpenChange(false);
    } catch (error) {
      setFejl(rpcErrorText(error));
    } finally {
      setBusy(false);
    }
  }

  // Only complain once something has been typed.
  const hint = !resultat.ok && tekst.trim() !== '' ? resultat.fejl : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange} height="partial" title={title}>
      <form onSubmit={(e) => void gem(e)}>
        <label className="felt">
          <span className="felt__label">{label}</span>
          <span className="indst-felt">
            <input
              className="felt__input indst-felt__input"
              type="text"
              inputMode={inputMode}
              value={tekst}
              onChange={(e) => setTekst(e.target.value)}
              autoComplete="off"
              enterKeyHint="done"
              autoFocus
            />
            {enhed && <span className="indst-felt__enhed">{enhed}</span>}
          </span>
        </label>
        {hint && <p className="felt-fejl">{hint}</p>}
        {note && <p className="felt-note">{note}</p>}
        {fejl && (
          <p className="felt-fejl" role="alert">
            {fejl}
          </p>
        )}
        <button type="submit" className="felt-knap felt-knap--naer" disabled={!kanGemme}>
          {t('indstillinger.gem')}
        </button>
      </form>
    </Sheet>
  );
}
