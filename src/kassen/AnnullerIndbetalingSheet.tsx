import { useState } from 'react';
import { Sheet } from '../components/Sheet.tsx';
import { formatKr, t } from '../strings/index.ts';
import { supabase } from '../supabase/index.ts';
import { rpcErrorText } from '../supabase/rpcErrors.ts';
import { dagTekst, type IndbetalingPost } from './kassen.ts';

interface AnnullerIndbetalingSheetProps {
  post: IndbetalingPost;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAnnulleret: () => void;
}

/**
 * Admin: annul an Indbetaling registered by mistake, with an optional note.
 * Mount with a fresh `key` per opening so the one-time ID is new.
 */
export function AnnullerIndbetalingSheet({ post, open, onOpenChange, onAnnulleret }: AnnullerIndbetalingSheetProps) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [fejl, setFejl] = useState<string | null>(null);
  // One ID per annulment, so "Prøv igen" never runs it twice.
  const [klientId] = useState(() => crypto.randomUUID());

  async function annuller() {
    setBusy(true);
    setFejl(null);
    const { error } = await supabase.rpc('annuller_indbetaling', {
      p_klient_id: klientId,
      p_indbetaling: post.id,
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
    <Sheet open={open} onOpenChange={onOpenChange} height="partial" title={t('annullerIndbetaling.titel')}>
      <p className="annuller-ind__linje">
        {t('annullerIndbetaling.linje', { af: post.registreretAf, dag: dagTekst(post.tid) })}
      </p>
      <div className="annuller-ind__top">
        <span className="annuller-ind__navn">{post.navn}</span>
        <span className="annuller-ind__beloeb">{t('kassen.plus', { beloeb: formatKr(post.beloeb) })}</span>
      </div>
      {post.note && <p className="annuller-ind__note">{post.note}</p>}

      <input
        className="annuller-ind__input"
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={t('annullerIndbetaling.note')}
        aria-label={t('annullerIndbetaling.note')}
        enterKeyHint="done"
      />

      {fejl && (
        <p className="annuller-ind__fejl" role="alert">
          {fejl}
        </p>
      )}
      <button type="button" className="annuller-ind__knap" disabled={busy} onClick={() => void annuller()}>
        {t('annullerIndbetaling.knap')}
      </button>
      <p className="annuller-ind__advarsel">{t('annullerIndbetaling.advarsel')}</p>
    </Sheet>
  );
}
