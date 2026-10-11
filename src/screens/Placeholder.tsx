import { Screen } from '../components/Screen.tsx';
import { t, type PlainStringId } from '../strings/index.ts';

/** Stand-in for a tab screen until its own ticket builds it. */
export function Placeholder({ title }: { title: PlainStringId }) {
  return (
    <Screen title={t(title)}>
      <p className="screen__placeholder">{t('skaerm.kommerSnart')}</p>
    </Screen>
  );
}
