import { useState } from 'react';
import { t, type PlainStringId } from '../../strings/index.ts';
import { rpcErrorText } from '../../supabase/rpcErrors.ts';
import './Annuller.css';

interface AnnullerFeltProps {
  /** The red button's label, e.g. 'annuller.boede'. */
  knap: PlainStringId;
  /** Calls the annul RPC with this one-time ID and the note. */
  annuller: (klientId: string, note: string) => PromiseLike<{ error: unknown }>;
  /** The annulment went through. */
  onAnnulleret: () => void;
}

/**
 * The annul form (boede-annuller.html): an optional note, a red-outlined
 * button and "En annullering kan ikke fortrydes." Used for Bøder and Gebyrer.
 * Mount it fresh per opening so the one-time ID is new.
 */
export function AnnullerFelt({ knap, annuller, onAnnulleret }: AnnullerFeltProps) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [fejl, setFejl] = useState<string | null>(null);
  // One ID per annulment, so "Prøv igen" never runs it twice.
  const [klientId] = useState(() => crypto.randomUUID());

  async function koer() {
    setBusy(true);
    setFejl(null);
    const { error } = await annuller(klientId, note);
    setBusy(false);
    if (error) {
      setFejl(rpcErrorText(error));
      return;
    }
    onAnnulleret();
  }

  return (
    <div className="annuller">
      <input
        className="annuller__input"
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={t('annuller.note')}
        aria-label={t('annuller.note')}
        enterKeyHint="done"
      />
      {fejl && (
        <p className="annuller__fejl" role="alert">
          {fejl}
        </p>
      )}
      <button type="button" className="annuller__knap" disabled={busy} onClick={() => void koer()}>
        {t(knap)}
      </button>
      <p className="annuller__advarsel">{t('annuller.advarsel')}</p>
    </div>
  );
}
