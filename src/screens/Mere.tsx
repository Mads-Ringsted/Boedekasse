import { LogOut } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider.tsx';
import { Screen } from '../components/Screen.tsx';
import { t } from '../strings/index.ts';
import './Mere.css';

/** Mere. For now only Log ud; the other rows come with their tickets (mocks/mere.html). */
export function Mere() {
  const { logOut } = useAuth();

  return (
    <Screen title={t('skaerm.mere')}>
      <p className="screen__placeholder">{t('skaerm.kommerSnart')}</p>
      <button type="button" className="mere__logud" onClick={() => void logOut()}>
        <LogOut size={20} aria-hidden="true" />
        {t('logUd')}
      </button>
    </Screen>
  );
}
