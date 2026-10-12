import { Navigate, useNavigate, useParams } from 'react-router';
import { Feed } from '../aktivitet/Feed.tsx';
import { TagMaerke } from '../aktivitet/TagMaerke.tsx';
import { useBodekasse } from '../bodekasse/BodekasseProvider.tsx';
import { BackButton } from '../components/BackButton.tsx';
import { Screen } from '../components/Screen.tsx';
import { Topliste } from '../screens/hjem/Topliste.tsx';
import { opdelTopliste } from '../screens/hjem/topliste.ts';
import { formatKr, t } from '../strings/index.ts';
import { useHent } from '../supabase/useHent.ts';
import { hentTidligereSaeson } from './hentSaesoner.ts';
import { SaesonVaelger } from './SaesonVaelger.tsx';
import { saesonPeriode } from './tidligere.ts';
import '../screens/hjem/Hjem.css';
import './Tidligere.css';

/**
 * `/saeson/:saesonId`: a past Sæson, read-only. Its name and dates, its
 * Bøder i alt and Indbetalt, its Topliste and its feed. Nothing here can be
 * changed: Topliste entries are not tappable, and the Bøde detail sheet
 * shows no actions for a Bøde outside the latest Sæson. The latest Sæson
 * goes to Hjem instead.
 */
export function TidligereSaeson() {
  const { saesonId = '' } = useParams();
  const { bodekasseId, medlemId } = useBodekasse();
  const navigate = useNavigate();
  const hentet = useHent(() => hentTidligereSaeson(bodekasseId, saesonId), [bodekasseId, saesonId]);
  const data = hentet.status === 'ready' ? hentet.data : null;

  if (data?.saeson?.erSeneste) return <Navigate to="/" replace />;

  const saeson = data?.saeson ?? null;
  const topliste = data && opdelTopliste(data.topliste);

  return (
    <Screen>
      <BackButton label={t('tab.hjem')} onClick={() => void navigate('/')} />

      {hentet.status === 'error' && (
        <button type="button" className="tidligere__fejl" onClick={hentet.reload}>
          {t('fejl.ukendt')}
        </button>
      )}
      {data && !saeson && <p className="screen__placeholder">{t('saeson.tidligere.findesIkke')}</p>}

      {data && saeson && topliste && (
        <>
          <div className="tidligere__hoved">
            <TagMaerke tag={{ tekst: t('saeson.tidligere.tag'), tone: 'graa' }} />
            <h1 className="tidligere__navn">{saeson.navn}</h1>
            <span className="tidligere__periode">{saesonPeriode(saeson)}</span>
          </div>
          <p className="tidligere__note">{t('saeson.tidligere.note')}</p>

          <div className="hjem__tal">
            <div className="hjem__tal-kort">
              <span className="hjem__tal-label">{t('saeson.tidligere.boederIAlt')}</span>
              <span className="hjem__tal-beloeb">{formatKr(data.boederIAlt)}</span>
            </div>
            <div className="hjem__tal-kort">
              <span className="hjem__tal-label">{t('saeson.tidligere.indbetalt')}</span>
              <span className="hjem__tal-beloeb hjem__tal-beloeb--ind">{formatKr(data.indbetalt)}</span>
            </div>
          </div>

          <div className="hjem__sektion">
            <h2 className="hjem__sektion-titel">{t('hjem.topliste')}</h2>
            <SaesonVaelger
              saesoner={data.saesoner}
              visesId={saeson.id}
              label={t('hjem.boederIAltSaeson', { saeson: saeson.navn })}
            />
          </div>
          {topliste.tom ? (
            <div className="hjem__tom">
              <span className="hjem__tom-titel">{t('hjem.toplisteTom')}</span>
            </div>
          ) : (
            <Topliste topliste={topliste} medlemId={medlemId} />
          )}

          <div className="hjem__sektion">
            <h2 className="hjem__sektion-titel">{t('saeson.tidligere.aktivitet')}</h2>
          </div>
          <Feed saesonId={saeson.id} />
        </>
      )}
    </Screen>
  );
}
