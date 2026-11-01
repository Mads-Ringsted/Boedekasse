import { useState } from 'react';
import { formatKr, t } from '../strings/index.ts';
import { rpcErrorText } from '../supabase/rpcErrors.ts';
import type { Melding } from './betal.ts';
import { fortrydBetalingsmelding } from './hentBetal.ts';
import './Betal.css';

interface MinMeldingKortProps {
  melding: Melding;
  erAdmin: boolean;
  /** Called after Fortryd withdrew the report; reload what you show. */
  onFortrudt: () => void;
  /** On a screen ("Venter på dig" on your profile) instead of inside the Betal sheet. */
  paaSkaerm?: boolean;
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
