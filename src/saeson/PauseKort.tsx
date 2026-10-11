import { useState } from 'react';
import { Pause } from 'lucide-react';
import { useBodekasse } from '../bodekasse/BodekasseProvider.tsx';
import { t } from '../strings/index.ts';
import { pauseLinje } from './saeson.ts';
import { StartSaesonSheet } from './SaesonSheets.tsx';
import { useSaeson } from './SaesonProvider.tsx';
import './Saeson.css';

/** Hjem in a Pause: "Pause · Sæson 2026 sluttede 30. sep", and "Start sæson" for Admins. */
export function PauseKort() {
  const { erAdmin } = useBodekasse();
  const { saeson, pause } = useSaeson();
  const [starter, setStarter] = useState(false);
  if (!pause || !saeson) return null;

  return (
    <div className="pause-kort">
      <span className="pause-kort__ikon">
        <Pause size={20} strokeWidth={2} aria-hidden="true" />
      </span>
      <span className="pause-kort__tekst">
        <span className="pause-kort__titel">{t('saeson.pause')}</span>
        <span className="pause-kort__linje">{pauseLinje(saeson)}</span>
      </span>
      {erAdmin && (
        <button type="button" className="pause-kort__knap" onClick={() => setStarter(true)}>
          {t('saeson.startKort')}
        </button>
      )}
      {erAdmin && <StartSaesonSheet open={starter} onOpenChange={setStarter} />}
    </div>
  );
}
