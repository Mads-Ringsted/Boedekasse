import { useSyncExternalStore } from 'react';
import { WifiOff } from 'lucide-react';
import { t } from '../strings/index.ts';
import './Offline.css';

function subscribe(onChange: () => void) {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

/** True while the phone has a connection. */
export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, () => navigator.onLine);
}

/**
 * A plain full-screen "Ingen forbindelse" cover. It sits on top of the app
 * instead of replacing it, so nothing is lost when the connection returns.
 */
export function Offline() {
  return (
    <div className="offline" role="alert">
      <WifiOff size={40} aria-hidden="true" className="offline__icon" />
      <h1 className="offline__title">{t('offline.titel')}</h1>
      <p className="offline__text">{t('offline.tekst')}</p>
    </div>
  );
}
