import { useState, type FormEvent } from 'react';
import { BackButton } from '../components/BackButton.tsx';
import { t } from '../strings/index.ts';
import { supabase } from '../supabase/index.ts';
import { rpcErrorText } from '../supabase/rpcErrors.ts';
import './Onboarding.css';

interface OpretBodekasseProps {
  onBack: () => void;
  /** The box exists and you are its Admin; open it. */
  onOprettet: (bodekasseId: string) => Promise<void>;
}

/** Box name and your own name; you become the first Admin. */
export function OpretBodekasse({ onBack, onOprettet }: OpretBodekasseProps) {
  const [navn, setNavn] = useState('');
  const [mitNavn, setMitNavn] = useState('');
  const [busy, setBusy] = useState(false);
  const [fejl, setFejl] = useState<string | null>(null);
  // One ID per visit, so "Prøv igen" after a lost answer never makes a second box.
  const [klientId] = useState(() => crypto.randomUUID());

  const kanOprette = navn.trim() !== '' && mitNavn.trim() !== '' && !busy;

  async function opret(event: FormEvent) {
    event.preventDefault();
    if (!kanOprette) return;
    setBusy(true);
    setFejl(null);
    const { data, error } = await supabase.rpc('opret_bodekasse', {
      p_klient_id: klientId,
      p_navn: navn,
      p_mit_navn: mitNavn,
    });
    if (error) {
      setFejl(rpcErrorText(error));
      setBusy(false);
      return;
    }
    await onOprettet((data as { bodekasse_id: string }).bodekasse_id);
  }

  return (
    <form className="onboarding" onSubmit={(e) => void opret(e)}>
      <BackButton label={t('sheet.tilbage')} onClick={onBack} />
      <h1 className="onboarding__title">{t('opret.titel')}</h1>

      <label className="onboarding__field">
        <span className="onboarding__label">{t('opret.navn')}</span>
        <input
          className="onboarding__input"
          type="text"
          value={navn}
          onChange={(e) => setNavn(e.target.value)}
          autoComplete="off"
          enterKeyHint="next"
          autoFocus
        />
      </label>

      <label className="onboarding__field">
        <span className="onboarding__label">{t('opret.mitNavn')}</span>
        <input
          className="onboarding__input"
          type="text"
          value={mitNavn}
          onChange={(e) => setMitNavn(e.target.value)}
          autoComplete="name"
          enterKeyHint="done"
        />
      </label>

      <p className="onboarding__note">{t('opret.note')}</p>
      {fejl && (
        <p className="onboarding__error" role="alert">
          {fejl}
        </p>
      )}

      <button type="submit" className="onboarding__primary" disabled={!kanOprette}>
        {t('opret.knap')}
      </button>
    </form>
  );
}
