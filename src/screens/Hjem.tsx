import { useBodekasse } from '../bodekasse/BodekasseProvider.tsx';
import { Screen } from '../components/Screen.tsx';
import { t } from '../strings/index.ts';

/** Stand-in for Hjem: shows which box is open. Its own ticket builds the screen. */
export function Hjem() {
  const { bodekasseNavn } = useBodekasse();

  return (
    <Screen title={bodekasseNavn}>
      <p className="screen__placeholder">{t('skaerm.kommerSnart')}</p>
    </Screen>
  );
}
