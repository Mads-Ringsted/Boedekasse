import { useState } from 'react';
import { Field } from '../components/Field.tsx';
import { Sheet } from '../components/Sheet.tsx';
import { SheetAction } from '../components/SheetAction.tsx';
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
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      height="partial"
      title={t('annullerHaevning.titel')}
      dirty={note !== ''}
      footer={
        <>
          <SheetAction className="annuller-ind__knap" disabled={busy} onClick={() => void annuller()} error={fejl}>
            {t('annullerHaevning.knap')}
          </SheetAction>
          <p className="annuller-ind__advarsel">{t('annullerIndbetaling.advarsel')}</p>
        </>
      }
    >
      <p className="annuller-ind__linje">
        {t('annullerHaevning.linje', { af: post.registreretAf, dag: dagTekst(post.tid) })}
      </p>
      <div className="annuller-ind__top">
        <span className="annuller-ind__navn">{post.formaal}</span>
        <span className="annuller-ind__beloeb annuller-haev__beloeb">
          {t('kassen.minus', { beloeb: formatKr(post.beloeb) })}
        </span>
      </div>

      <Field
        className="annuller-ind__felt"
        label={t('annullerIndbetaling.note')}
        hideLabel
        value={note}
        onChange={setNote}
        placeholder={t('annullerIndbetaling.note')}
      />
    </Sheet>
  );
}
