import { useNavigate } from 'react-router';
import { BackButton } from '../components/BackButton.tsx';
import { Screen } from '../components/Screen.tsx';
import { t, type PlainStringId } from '../strings/index.ts';

interface PlaceholderProps {
  title: PlainStringId;
  /** For a pushed screen: the back button's label and where it goes. */
  back?: { label: PlainStringId; to: string };
}

/** Stand-in for a screen until its own ticket builds it. */
export function Placeholder({ title, back }: PlaceholderProps) {
  const navigate = useNavigate();
  return (
    <Screen title={back ? undefined : t(title)}>
      {back && (
        <>
          <BackButton label={t(back.label)} onClick={() => void navigate(back.to)} />
          <h1 className="screen__title">{t(title)}</h1>
        </>
      )}
      <p className="screen__placeholder">{t('skaerm.kommerSnart')}</p>
    </Screen>
  );
}
