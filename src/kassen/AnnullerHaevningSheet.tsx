import { useState } from 'react';
import { Sheet } from '../components/Sheet.tsx';
import { formatKr, t } from '../strings/index.ts';
import { supabase } from '../supabase/index.ts';
import { rpcErrorText } from '../supabase/rpcErrors.ts';
import { dagTekst, type HaevningPost } from './kassen.ts';

interface AnnullerHaevningSheetProps {
  post: HaevningPost;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAnnulleret: () => void;
}

/**
 * Admin: annul a Hævning made by mistake, with an optional note. The money
 * is back in Kassen. Styled like Annullér indbetaling.
 * Mount with a fresh `key` per opening so the one-time ID is new.
 */
export function AnnullerHaevningSheet({ post, open, onOpenChange, onAnnulleret }: AnnullerHaevningSheetProps) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [fejl, setFejl] = useState<string | null>(null);
  // One ID per annulment, so "Prøv igen" never runs it twice.
  const [klientId] = useState(() => crypto.randomUUID());

  async function annuller() {
    setBusy(true);
    setFejl(null);
    const { error } = await supabase.rpc('annuller_haevning', {
      p_klient_id: klientId,
      p_haevning: post.id,
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
    <Sheet open={open} onOpenChange={onOpenChange} height="partial" title={t('annullerHaevning.titel')}>
      <p className="annuller-ind__linje">
        {t('annullerHaevning.linje', { af: post.registreretAf, dag: dagTekst(post.tid) })}
      </p>
      <div className="annuller-ind__top">
        <span className="annuller-ind__navn">{post.formaal}</span>
        <span className="annuller-ind__beloeb annuller-haev__beloeb">
          {t('kassen.minus', { beloeb: formatKr(post.beloeb) })}
        </span>
      </div>

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
        {t('annullerHaevning.knap')}
      </button>
      <p className="annuller-ind__advarsel">{t('annullerIndbetaling.advarsel')}</p>
    </Sheet>
  );
}
