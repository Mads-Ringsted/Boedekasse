import { useRef, useState, type FormEvent } from 'react';
import { Field } from '../components/Field.tsx';
import { primaryAction, typedRequirement, visibleError } from '../components/field.ts';
import { Sheet } from '../components/Sheet.tsx';
import { SheetAction } from '../components/SheetAction.tsx';
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
  inputMode?: 'text' | 'numeric' | 'decimal';
  note?: string;
}

const FORM_ID = 'ret-indstilling';

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
  const felt = useRef<HTMLInputElement>(null);

  const resultat = tjek(tekst);
  const handling = primaryAction(
    [typedRequirement(tekst, resultat.ok, t('aarsag.skrivVaerdi'), t('aarsag.retVaerdien'))],
    { busy, unchanged: tekst === start },
  );
  const kanGemme = handling.enabled;

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
  const hint = visibleError(tekst, resultat.ok ? null : resultat.fejl);

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      height="partial"
      title={title}
      initialFocus={felt}
      dirty={tekst !== start}
      footer={
        <SheetAction form={FORM_ID} disabled={!kanGemme} reason={handling.reason} error={fejl}>
          {t('indstillinger.gem')}
        </SheetAction>
      }
    >
      <form id={FORM_ID} onSubmit={(e) => void gem(e)}>
        <Field
          ref={felt}
          label={label}
          kind={inputMode === 'numeric' ? 'integer' : inputMode}
          unit={enhed}
          value={tekst}
          onChange={setTekst}
          error={hint}
          note={note}
        />
      </form>
    </Sheet>
  );
}
