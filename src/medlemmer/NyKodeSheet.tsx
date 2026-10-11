import { useState } from 'react';
import { useBodekasse } from '../bodekasse/BodekasseProvider.tsx';
import { Sheet } from '../components/Sheet.tsx';
import { t } from '../strings/index.ts';
import { supabase } from '../supabase/index.ts';
import { rpcErrorText } from '../supabase/rpcErrors.ts';
import './felter.css';

interface NyKodeSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The code in use now; it stops working. */
  kode: string;
  onFornyet: () => void;
}

/** Ny kode (Admin): confirms, then makes a new join code. The old one stops working. */
export function NyKodeSheet({ open, onOpenChange, kode, onFornyet }: NyKodeSheetProps) {
  const { bodekasseId } = useBodekasse();
  const [busy, setBusy] = useState(false);
  const [fejl, setFejl] = useState<string | null>(null);
  const [klientId, setKlientId] = useState(() => crypto.randomUUID());

  function skift(aaben: boolean) {
    if (!aaben) {
      setFejl(null);
      setKlientId(crypto.randomUUID());
    }
    onOpenChange(aaben);
  }

  async function forny() {
    setBusy(true);
    setFejl(null);
    const { error } = await supabase.rpc('forny_join_kode', { p_klient_id: klientId, p_bodekasse: bodekasseId });
    setBusy(false);
    if (error) {
      setFejl(rpcErrorText(error));
      return;
    }
    skift(false);
    onFornyet();
  }

  return (
    <Sheet open={open} onOpenChange={skift} height="partial" title={t('medlemmer.nyKodeTitel')}>
      <p className="felt-note">{t('medlemmer.nyKodeTekst', { kode })}</p>
      {fejl && (
        <p className="felt-fejl" role="alert">
          {fejl}
        </p>
      )}
      <button type="button" className="felt-knap felt-knap--naer" disabled={busy} onClick={() => void forny()}>
        {t('medlemmer.nyKodeKnap')}
      </button>
    </Sheet>
  );
}
