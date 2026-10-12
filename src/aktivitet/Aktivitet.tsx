import { Screen } from '../components/Screen.tsx';
import { t } from '../strings/index.ts';
import { Feed } from './Feed.tsx';

/** The Aktivitet tab: everything that happened this Sæson, newest first. */
export function Aktivitet() {
  return (
    <Screen title={t('skaerm.aktivitet')}>
      <Feed />
    </Screen>
  );
}
