import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider.tsx';
import { Sheet } from '../components/Sheet.tsx';
import { t } from '../strings/index.ts';
import { rpcErrorText } from '../supabase/rpcErrors.ts';
import { useHent } from '../supabase/useHent.ts';
import { hentSidsteAdminKasser, sletKonto } from './hentSlet.ts';
import './Slet.css';

const liste = new Intl.ListFormat('da', { type: 'conjunction' });

/**
 * Slet konto, from the bottom of your own profile. Deletes your login; your
 * Medlemmer stay with name and history as unclaimed spots. While you are the
 * last Admin of a box, it says so instead of offering the button. Afterwards
 * the app logs out on this device and shows Log ind.
 * Mount with a fresh `key` per opening, so the one-time ID is new.
 */
export function SletKontoSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { logOut } = useAuth();
  const kasser = useHent(hentSidsteAdminKasser, []);
  const [klientId] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [fejl, setFejl] = useState<string | null>(null);
  const blokeret = kasser.status === 'ready' && kasser.data.length > 0;

  async function slet() {
    setBusy(true);
    setFejl(null);
    try {
      await sletKonto(klientId);
    } catch (e) {
      setBusy(false);
      setFejl(rpcErrorText(e));
      return;
    }
    // The login is gone on the server; forget the session here too (→ Log ind).
    if (!(await logOut())) {
      setBusy(false);
      setFejl(t('offline.proevIgen'));
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange} height="partial" title={t('sletKonto.titel')}>
      {blokeret ? (
        <p className="slet__note" role="alert">
          {t('sletKonto.sidsteAdmin', { kasser: liste.format(kasser.data) })}
        </p>
      ) : (
        <p className="slet__note">{t('sletKonto.tekst')}</p>
      )}
      {kasser.status === 'error' && (
        <button type="button" className="slet__fejl" onClick={kasser.reload}>
          {rpcErrorText(kasser.error)} · {t('handling.proevIgen')}
        </button>
      )}
      {fejl && (
        <p className="slet__fejl" role="alert">
          {fejl}
        </p>
      )}
      {!blokeret && (
        <button
          type="button"
          className="slet__knap slet__knap--naer"
          disabled={busy || kasser.status !== 'ready'}
          onClick={() => void slet()}
        >
          {t('sletKonto.knap')}
        </button>
      )}
    </Sheet>
  );
}
