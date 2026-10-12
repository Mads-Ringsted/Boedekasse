import { useState } from 'react';
import { useBodekasse } from '../bodekasse/BodekasseProvider.tsx';
import { formatKr, t } from '../strings/index.ts';
import { rpcErrorText } from '../supabase/rpcErrors.ts';
import { useHent } from '../supabase/useHent.ts';
import { minMelding, type Melding } from './betal.ts';
import { fortrydBetalingsmelding, hentMeldinger } from './hentBetal.ts';
import './Betal.css';

interface MinMeldingKortProps {
  melding: Melding;
  erAdmin: boolean;
  /** Called after Fortryd withdrew the report; reload what you show. */
  onFortrudt: () => void;
  /** On a screen (your profile) instead of inside the Betal sheet. */
  paaSkaerm?: boolean;
}

/**
 * For your own profile: loads your report that afventer and shows
 * `MinMeldingKort`, or nothing when there is none. It loads again whenever
 * `opdater` changes (any value; compared with Object.is).
 */
export function MinAfventendeMelding({ opdater, onFortrudt }: { opdater?: unknown; onFortrudt?: () => void }) {
  const { bodekasseId, medlemId, erAdmin } = useBodekasse();
  const hentet = useHent(() => hentMeldinger(bodekasseId), [bodekasseId, opdater]);
  const melding = hentet.status === 'ready' ? minMelding(hentet.data, medlemId) : null;
  if (!melding) return null;
  return (
    <MinMeldingKort
      key={melding.id}
      melding={melding}
      erAdmin={erAdmin}
      paaSkaerm
      onFortrudt={() => {
        hentet.reload();
        onFortrudt?.();
      }}
    />
  );
}

/**
 * Your own report that afventer: orange "Afventer" card, "Du har meldt 6 kr
 * betalt", with Fortryd. Shown on the Betal sheet and your own profile.
 */
export function MinMeldingKort({ melding, erAdmin, onFortrudt, paaSkaerm = false }: MinMeldingKortProps) {
  const [busy, setBusy] = useState(false);
  const [fejl, setFejl] = useState<string | null>(null);
  // One ID per report, so "Prøv igen" never runs it twice.
  const [klientId] = useState(() => crypto.randomUUID());

  async function fortryd() {
    setBusy(true);
    setFejl(null);
    try {
      await fortrydBetalingsmelding(klientId, melding.id);
      onFortrudt();
    } catch (error) {
      setFejl(rpcErrorText(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`afventer-kort betal-afventer${paaSkaerm ? ' betal-afventer--skaerm' : ''}`}>
      <span className="afventer-kort__status">
        <span className="afventer-kort__prik" aria-hidden="true" />
        {t('betal.afventer')}
      </span>
      <span className="betal-afventer__tekst">
        <span className="betal-afventer__titel">{t('betal.duHarMeldt', { beloeb: formatKr(melding.beloeb) })}</span>
        <span className="betal-afventer__under">{t(erAdmin ? 'betal.duErAdmin' : 'betal.enAnden')}</span>
      </span>
      {fejl && (
        <p className="betal__fejl" role="alert">
          {fejl}
        </p>
      )}
      <button type="button" className="betal-afventer__fortryd" disabled={busy} onClick={() => void fortryd()}>
        {t('betal.fortryd')}
      </button>
    </div>
  );
}
