import { useState, type FormEvent } from 'react';
import { Sheet } from '../components/Sheet.tsx';
import { kortNavne } from '../giv/navne.ts';
import { formatKr, t } from '../strings/index.ts';
import { supabase } from '../supabase/index.ts';
import { rpcErrorText } from '../supabase/rpcErrors.ts';
import type { AktivtFrikob } from './frikob.ts';
import '../medlemmer/felter.css';
import './Frikob.css';

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
    >
      <form onSubmit={(e) => void annuller(e)}>
        <p className="frikob-annuller__tekst">
          {t('frikob.annullerTekst', {
            person: kortNavne([frikob.medlemNavn])[0] ?? frikob.medlemNavn,
            navn: frikob.bodekategoriNavn,
            beloeb: formatKr(frikob.pris),
          })}
        </p>
        <label className="felt">
          <span className="felt__label">{t('frikob.note')}</span>
          <input className="felt__input" value={note} onChange={(e) => setNote(e.target.value)} autoComplete="off" />
        </label>
        {fejl && (
          <p className="felt-fejl" role="alert">
            {fejl}
          </p>
        )}
        <button type="submit" className="felt-knap frikob-annuller__knap" disabled={busy}>
          {t('frikob.annuller')}
        </button>
      </form>
    </Sheet>
  );
}
