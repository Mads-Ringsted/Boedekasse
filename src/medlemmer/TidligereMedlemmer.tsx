import { useState } from 'react';
import { useBodekasse } from '../bodekasse/BodekasseProvider.tsx';
import { Avatar } from '../components/Avatar.tsx';
import { formatKr, t } from '../strings/index.ts';
import { supabase } from '../supabase/index.ts';
import { rpcErrorText } from '../supabase/rpcErrors.ts';
import type { TidligereLinje } from './medlemsliste.ts';
import './AdminHandlinger.css';

interface TidligereMedlemmerProps {
  linjer: TidligereLinje[];
  onAabn: (medlemId: string) => void;
  onGenoptaget: () => void;
}

/**
 * Tidligere medlemmer at the bottom of Medlemmer (medlemmer.html): each
 * Udmeldt with what they still owe. Admins get Genoptag (same spot, full
 * history). Nothing shows when nobody is Udmeldt.
 */
export function TidligereMedlemmer({ linjer, onAabn, onGenoptaget }: TidligereMedlemmerProps) {
  const { bodekasseId, erAdmin } = useBodekasse();
  const [busy, setBusy] = useState<string | null>(null);
  const [fejl, setFejl] = useState<string | null>(null);
  if (linjer.length === 0) return null;

  async function genoptag(medlemId: string) {
    setBusy(medlemId);
    setFejl(null);
    const { error } = await supabase.rpc('genoptag', {
      p_klient_id: crypto.randomUUID(),
      p_bodekasse: bodekasseId,
      p_medlem: medlemId,
    });
    setBusy(null);
    if (error) {
      setFejl(rpcErrorText(error));
      return;
    }
    onGenoptaget();
  }

  return (
    <>
      <h2 className="tidligere__titel">{t('medlemmer.tidligere')}</h2>
      {fejl && (
        <p className="tidligere__fejl" role="alert">
          {fejl}
        </p>
      )}
      <ul className="tidligere__liste">
        {linjer.map((m) => (
          <li key={m.id} className="tidligere-linje">
            <button type="button" className="tidligere-linje__profil" onClick={() => onAabn(m.id)}>
              <Avatar navn={m.navn} size={36} tidligere />
              <span className="tidligere-linje__tekst">
                <span className="tidligere-linje__navn">{m.navn}</span>
                <Beloeb saldo={m.saldo} />
              </span>
            </button>
            {erAdmin && (
              <button
                type="button"
                className="tidligere-linje__genoptag"
                disabled={busy !== null}
                onClick={() => void genoptag(m.id)}
              >
                {t('adminHandlinger.genoptag')}
              </button>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

function Beloeb({ saldo }: { saldo: number }) {
  if (saldo > 0) {
    return (
      <span className="tidligere-linje__beloeb tidligere-linje__beloeb--mangler">
        {t('medlemmer.tidligereMangler', { beloeb: formatKr(saldo) })}
      </span>
    );
  }
  if (saldo < 0) {
    return (
      <span className="tidligere-linje__beloeb tidligere-linje__beloeb--til-gode">
        {t('medlemmer.tilGode', { beloeb: formatKr(-saldo) })}
      </span>
    );
  }
  return <span className="tidligere-linje__beloeb">{t('medlemmer.tidligereSkylderIntet')}</span>;
}
