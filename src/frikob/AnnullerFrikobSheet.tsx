import { useState, type FormEvent } from 'react';
import { Field } from '../components/Field.tsx';
import { Sheet } from '../components/Sheet.tsx';
import { SheetAction } from '../components/SheetAction.tsx';
import { kortNavne } from '../giv/navne.ts';
import { formatKr, t } from '../strings/index.ts';
import { supabase } from '../supabase/index.ts';
import { rpcErrorText } from '../supabase/rpcErrors.ts';
import type { AktivtFrikob } from './frikob.ts';
import '../medlemmer/felter.css';
import './Frikob.css';

const FORM_ID = 'annuller-frikob';

interface AnnullerFrikobSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  frikob: AktivtFrikob;
  onAnnulleret: () => void;
}

/**
 * Admin: annul a Frikøb (and its Frikøbsgebyr) with an optional note.
 * Mount with a fresh `key` per opening so the one-time ID is new.
 */
export function AnnullerFrikobSheet({ open, onOpenChange, frikob, onAnnulleret }: AnnullerFrikobSheetProps) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [fejl, setFejl] = useState<string | null>(null);
  const [klientId] = useState(() => crypto.randomUUID());

  async function annuller(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setFejl(null);
    const { error } = await supabase.rpc('annuller_frikob', {
      p_klient_id: klientId,
      p_frikob: frikob.id,
      p_note: note,
    });
    setBusy(false);
    if (error) {
      setFejl(rpcErrorText(error));
      return;
    }
    onOpenChange(false);
    onAnnulleret();
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      height="partial"
      title={t('frikob.annullerTitel', { navn: frikob.bodekategoriNavn })}
      dirty={note !== ''}
      footer={
        <SheetAction form={FORM_ID} className="felt-knap frikob-annuller__knap" disabled={busy} error={fejl}>
          {t('frikob.annuller')}
        </SheetAction>
      }
    >
      <form id={FORM_ID} onSubmit={(e) => void annuller(e)}>
        <p className="frikob-annuller__tekst">
          {t('frikob.annullerTekst', {
            person: kortNavne([frikob.medlemNavn])[0] ?? frikob.medlemNavn,
            navn: frikob.bodekategoriNavn,
            beloeb: formatKr(frikob.pris),
          })}
        </p>
        <Field label={t('frikob.note')} value={note} onChange={setNote} />
      </form>
    </Sheet>
  );
}
