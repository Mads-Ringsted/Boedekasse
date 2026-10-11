import { BackButton } from '../components/BackButton.tsx';
import { t } from '../strings/index.ts';
import './Onboarding.css';

/**
 * Stand-in for joining with a code. #51 builds it (mocks/jeg-har-en-kode.html):
 * six boxes, the box found, your name, then `onJoined(bodekasseId)` like Opret.
 */
export function JegHarEnKode({ onBack }: { onBack: () => void }) {
  return (
    <main className="onboarding">
      <BackButton label={t('sheet.tilbage')} onClick={onBack} />
      <h1 className="onboarding__title">{t('kode.titel')}</h1>
      <p className="onboarding__note">{t('skaerm.kommerSnart')}</p>
    </main>
  );
}
