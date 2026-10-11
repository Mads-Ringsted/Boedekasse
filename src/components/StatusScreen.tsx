import { t } from '../strings/index.ts';
import './StatusScreen.css';

/**
 * A full screen with no tab bar for start-up states: empty while loading,
 * or a message with "Prøv igen".
 */
export function StatusScreen({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <main className="status-screen" aria-busy={message ? undefined : true}>
      {message && <p className="status-screen__message">{message}</p>}
      {onRetry && (
        <button type="button" className="status-screen__retry" onClick={onRetry}>
          {t('handling.proevIgen')}
        </button>
      )}
    </main>
  );
}
