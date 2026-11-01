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

/** The annul form's state: the note, and running the RPC with one ID per opening. */
export function useAnnuller(annuller: AnnullerFeltProps['annuller'], onAnnulleret: () => void) {
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

  return { note, setNote, busy, fejl, koer: () => void koer() };
}

type Annullering = ReturnType<typeof useAnnuller>;

/** The optional note and the error. */
export function AnnullerNote({ a }: { a: Annullering }) {
  return (
    <>
      <input
        className="annuller__input"
        type="text"
        value={a.note}
        onChange={(e) => a.setNote(e.target.value)}
        placeholder={t('annuller.note')}
        aria-label={t('annuller.note')}
        enterKeyHint="done"
      />
      {a.fejl && (
        <p className="annuller__fejl" role="alert">
          {a.fejl}
        </p>
      )}
    </>
  );
}

/** The red-outlined button and "En annullering kan ikke fortrydes." */
export function AnnullerKnap({ a, knap }: { a: Annullering; knap: PlainStringId }) {
  return (
    <>
      <button type="button" className="annuller__knap" disabled={a.busy} onClick={a.koer}>
        {t(knap)}
      </button>
      <p className="annuller__advarsel">{t('annuller.advarsel')}</p>
    </>
  );
}

/**
 * The annul form (boede-annuller.html) in one piece, for the Bøde detail
 * sheet, where it is one action among several. A sheet of its own uses
 * `useAnnuller` and puts `AnnullerKnap` in its footer. Mount it fresh per
 * opening so the one-time ID is new.
 */
export function AnnullerFelt({ knap, annuller, onAnnulleret }: AnnullerFeltProps) {
  const a = useAnnuller(annuller, onAnnulleret);
  return (
    <div className="annuller">
      <AnnullerNote a={a} />
      <AnnullerKnap a={a} knap={knap} />
    </div>
  );
}
