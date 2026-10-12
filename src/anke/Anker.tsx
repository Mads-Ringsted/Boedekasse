import { useNavigate } from 'react-router';
import { useBoedeDetalje } from '../aktivitet/boede/BoedeDetaljeProvider.tsx';
import { FeedRaekke } from '../aktivitet/FeedRaekke.tsx';
import { useBodekasse } from '../bodekasse/BodekasseProvider.tsx';
import { BackButton } from '../components/BackButton.tsx';
import { Screen } from '../components/Screen.tsx';
import { useGivBoeder } from '../giv/GivBoederProvider.tsx';
import { t } from '../strings/index.ts';
import { rpcErrorText } from '../supabase/rpcErrors.ts';
import { useHent } from '../supabase/useHent.ts';
import { ankerRaekke } from './anker.ts';
import { hentAabneAnker } from './hentAnke.ts';
import '../aktivitet/Feed.css';
import './Anke.css';

/**
 * Mere → Anker: every Bøde with an open Anke, newest first. A row opens the
 * Bøde detail sheet, where the verdict goes (#64). Reloads when a Bøde changes.
 */
export function Anker() {
  const { bodekasseId, medlemId } = useBodekasse();
  const navigate = useNavigate();
  const { aabn, version } = useBoedeDetalje();
  const giv = useGivBoeder();
  const hentet = useHent(() => hentAabneAnker(bodekasseId), [bodekasseId, version, giv.version]);
  const ctx = { migId: medlemId };

  return (
    <Screen>
      <BackButton label={t('tab.mere')} onClick={() => void navigate('/mere')} />
      <h1 className="screen__title">{t('mere.anker')}</h1>
      <p className="anker__intro">{t('anker.intro')}</p>

      {hentet.status === 'error' && (
        <button type="button" className="anker__tom" onClick={hentet.reload}>
          {rpcErrorText(hentet.error)} · {t('handling.proevIgen')}
        </button>
      )}
      {hentet.status === 'ready' && hentet.data.length === 0 && <p className="anker__tom">{t('anker.tom')}</p>}
      {hentet.status === 'ready' && hentet.data.length > 0 && (
        <ul className="feed__kort">
          {hentet.data.map((b) => (
            <FeedRaekke key={b.id} raekke={ankerRaekke(b, ctx)} onAabnBoede={aabn} />
          ))}
        </ul>
      )}
    </Screen>
  );
}
