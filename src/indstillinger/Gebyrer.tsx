import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { useBodekasse } from '../bodekasse/BodekasseProvider.tsx';
import { BackButton } from '../components/BackButton.tsx';
import { Screen } from '../components/Screen.tsx';
import { t } from '../strings/index.ts';
import { rpcErrorText } from '../supabase/rpcErrors.ts';
import { GEBYRER_AUTOMATISKE, GEBYRER_NAAR_NOGEN } from './gebyrer.ts';
import { Gruppe, RegelRaekke } from './raekker.tsx';
import type { Regel } from './regel.ts';
import { RegelSheet } from './RegelSheet.tsx';
import { TilbagevendendeGruppe } from './TilbagevendendeGruppe.tsx';
import { useIndstillinger } from './useIndstillinger.ts';
import './Indstillinger.css';

/**
 * Indstillinger → Gebyrer (#95, Admin only): every Gebyr in three groups.
 * "Når nogen gør noget" and "Automatiske" are rule rows (see `gebyrer.ts`);
 * "Tilbagevendende" is the running list with "+ Nyt".
 */
export function Gebyrer() {
  const { erAdmin } = useBodekasse();
  if (!erAdmin) return <Navigate to="/mere" replace />;
  return <GebyrerSkaerm />;
}

function GebyrerSkaerm() {
  const navigate = useNavigate();
  const { status, error, reload, indstillinger: ind, gem } = useIndstillinger();
  const [regel, setRegel] = useState<{ n: number; open: boolean; regel: Regel } | null>(null);

  function aabnRegel(r: Regel) {
    setRegel((s) => ({ n: (s?.n ?? 0) + 1, open: true, regel: r }));
  }

  return (
    <Screen>
      <BackButton label={t('mere.indstillinger')} onClick={() => void navigate('/indstillinger')} />
      <h1 className="screen__title">{t('indstillinger.gebyrer')}</h1>

      {status === 'error' && (
        <button type="button" className="indst__fejl" onClick={reload}>
          {rpcErrorText(error)} · {t('handling.proevIgen')}
        </button>
      )}

      {ind && (
        <>
          <Gruppe titel={t('indstillinger.gebyrerNaarNogen')}>
            {GEBYRER_NAAR_NOGEN.map((r) => (
              <RegelRaekke key={r.id} label={r.titel} status={r.status(ind)} onClick={() => aabnRegel(r)} />
            ))}
          </Gruppe>
          <Gruppe titel={t('indstillinger.gebyrerAutomatiske')}>
            {GEBYRER_AUTOMATISKE.map((r) => (
              <RegelRaekke key={r.id} label={r.titel} status={r.status(ind)} onClick={() => aabnRegel(r)} />
            ))}
          </Gruppe>
        </>
      )}

      <TilbagevendendeGruppe />

      {regel && ind && (
        <RegelSheet
          key={regel.n}
          open={regel.open}
          onOpenChange={(open) => setRegel((s) => s && { ...s, open })}
          regel={regel.regel}
          indstillinger={ind}
          gem={gem}
        />
      )}
    </Screen>
  );
}
