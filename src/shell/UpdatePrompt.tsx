import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X } from 'lucide-react';
import { t } from '../strings/index.ts';
import './UpdatePrompt.css';

const CHECK_EVERY_MS = 60 * 60 * 1000;

/**
 * Asks the service worker to look for a new version. Installed apps can sit
 * suspended for days, so we check when the app becomes visible and hourly.
 */
function watchForUpdates(swUrl: string, registration: ServiceWorkerRegistration) {
  const check = async () => {
    if (registration.installing || !navigator.onLine) return;
    try {
      const resp = await fetch(swUrl, { cache: 'no-store', headers: { 'cache-control': 'no-cache' } });
      if (resp.status === 200) await registration.update();
    } catch {
      // Offline or the server is down: try again next time.
    }
  };
  setInterval(check, CHECK_EVERY_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void check();
  });
}

/** A toast above the tab bar when a new app version is ready. */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      if (registration) watchForUpdates(swUrl, registration);
    },
  });

  if (!needRefresh) return null;

  return (
    <div className="update" role="status">
      <RefreshCw size={18} aria-hidden="true" className="update__icon" />
      <span className="update__text">{t('opdatering.klar')}</span>
      <button type="button" className="update__reload" onClick={() => void updateServiceWorker(true)}>
        {t('opdatering.genindlaes')}
      </button>
      <button
        type="button"
        className="update__close"
        aria-label={t('sheet.luk')}
        onClick={() => setNeedRefresh(false)}
      >
        <X size={18} aria-hidden="true" />
      </button>
    </div>
  );
}
