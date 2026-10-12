import { ChevronRight, KeyRound, Plus } from 'lucide-react';
import { useAuth, useUser } from '../auth/AuthProvider.tsx';
import { useVisOnboarding } from '../onboarding/Onboarding.tsx';
import { t } from '../strings/index.ts';
import './Velkommen.css';

/** Logged in, in no box yet: Opret Bødekasse or Jeg har en kode. */
export function Velkommen() {
  const user = useUser();
  const { logOut } = useAuth();
  const vis = useVisOnboarding();

  return (
    <main className="velkommen">
      <h1 className="velkommen__title">{t('velkommen.titel')}</h1>
      <p className="velkommen__intro">{t('velkommen.intro')}</p>

      <div className="velkommen__valg">
        <button type="button" className="velkommen__kort velkommen__kort--opret" onClick={() => vis('opret')}>
          <span className="velkommen__ikon">
            <Plus size={24} strokeWidth={2.2} aria-hidden="true" />
          </span>
          <span className="velkommen__tekst">
            <span className="velkommen__overskrift">{t('velkommen.opret')}</span>
            <span className="velkommen__under">{t('velkommen.opretTekst')}</span>
          </span>
          <ChevronRight size={20} strokeWidth={2.2} aria-hidden="true" />
        </button>

        <button type="button" className="velkommen__kort" onClick={() => vis('kode')}>
          <span className="velkommen__ikon">
            <KeyRound size={24} strokeWidth={2} aria-hidden="true" />
          </span>
          <span className="velkommen__tekst">
            <span className="velkommen__overskrift">{t('velkommen.kode')}</span>
            <span className="velkommen__under">{t('velkommen.kodeTekst')}</span>
          </span>
          <ChevronRight className="velkommen__chevron" size={20} strokeWidth={2.2} aria-hidden="true" />
        </button>
      </div>

      <p className="velkommen__footer">
        {t('velkommen.loggetIndSom', { email: user.email ?? '' })}
        {' · '}
        <button type="button" className="velkommen__logud" onClick={() => void logOut()}>
          {t('logUd')}
        </button>
      </p>
    </main>
  );
}
