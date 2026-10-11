import { useAuth, useUser } from '../auth/AuthProvider.tsx';
import { t } from '../strings/index.ts';
import './Velkommen.css';

/**
 * Logged in, in no box yet. Placeholder: #50 adds the "Opret Bødekasse" and
 * "Jeg har en kode" cards (see mocks/velkommen.html). After either, call
 * `useMedlemskaber().reload()` and the app opens the box.
 */
export function Velkommen() {
  const user = useUser();
  const { logOut } = useAuth();

  return (
    <main className="velkommen">
      <h1 className="velkommen__title">{t('velkommen.titel')}</h1>
      <p className="velkommen__intro">{t('velkommen.intro')}</p>
      <p className="screen__placeholder">{t('skaerm.kommerSnart')}</p>
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
