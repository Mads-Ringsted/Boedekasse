import { useLayoutEffect, useRef, useState } from 'react';
import { CalendarDays, Check, ChevronDown } from 'lucide-react';
import { Outlet, useSearchParams } from 'react-router';
import { useBodekasse } from '../bodekasse/BodekasseProvider.tsx';
import { Screen } from '../components/Screen.tsx';
import { Sheet } from '../components/Sheet.tsx';
import { StatusScreen } from '../components/StatusScreen.tsx';
import { useGivBoeder } from '../giv/GivBoederProvider.tsx';
import { useSaeson } from '../saeson/SaesonProvider.tsx';
import { saesonPeriode } from '../saeson/tidligere.ts';
import { t, type PlainStringId } from '../strings/index.ts';
import { useHent } from '../supabase/useHent.ts';
import { Barometer } from './Barometer.tsx';
import { Dig } from './Dig.tsx';
import { hentStatistik } from './hentStatistik.ts';
import { Holdet } from './Holdet.tsx';
import { Rekorder } from './Rekorder.tsx';
import { StatContext, useBygStat, useStat } from './StatistikData.tsx';
import '../saeson/Tidligere.css';
import './Statistik.css';

/**
 * The Statistik tab and its pushed pages (Nemesis, Dig og de andre, Dine
 * bødetyper). Loads the picked Sæson (`?saeson=`, default the latest) once
 * for all of them.
 */
export function Statistik() {
  const { bodekasseId, medlemId } = useBodekasse();
  const [params] = useSearchParams();
  const saesonId = params.get('saeson');
  const { version } = useGivBoeder();
  const { version: saesonVersion } = useSaeson();
  const hentet = useHent(
    () => hentStatistik(bodekasseId, saesonId),
    [bodekasseId, saesonId, version, saesonVersion],
  );
  const [nu] = useState(() => Date.now());
  const stat = useBygStat(hentet.status === 'ready' ? hentet.data : null, medlemId, nu);

  if (!stat) {
    return hentet.status === 'error' ? (
      <StatusScreen message={t('fejl.ukendt')} onRetry={hentet.reload} />
    ) : (
      <StatusScreen />
    );
  }
  return (
    <StatContext.Provider value={stat}>
      <Outlet />
    </StatContext.Provider>
  );
}

const FANER: { id: Fane; label: PlainStringId }[] = [
  { id: 'dig', label: 'stat.fane.dig' },
  { id: 'holdet', label: 'stat.fane.holdet' },
  { id: 'barometer', label: 'stat.fane.barometer' },
  { id: 'rekorder', label: 'stat.fane.rekorder' },
];
type Fane = 'dig' | 'holdet' | 'barometer' | 'rekorder';

/** Statistik: the period pill, the four segments, and the picked one's cards. */
export function StatistikFaner() {
  const [params, setParams] = useSearchParams();
  const fane = (FANER.find((f) => f.id === params.get('fane'))?.id ?? 'dig') as Fane;
  // Each segment keeps its own scroll position.
  const rulning = useRef<Partial<Record<Fane, number>>>({});

  function vaelg(ny: Fane) {
    if (ny === fane) return;
    rulning.current[fane] = window.scrollY;
    const p = new URLSearchParams(params);
    p.set('fane', ny);
    setParams(p, { replace: true });
  }
  useLayoutEffect(() => {
    window.scrollTo(0, rulning.current[fane] ?? 0);
  }, [fane]);

  return (
    <Screen>
      <div className="stat-top">
        <div className="stat-top__raekke">
          <h1 className="screen__title">{t('skaerm.statistik')}</h1>
          <Periode />
        </div>
        <div role="tablist" aria-label={t('stat.visning')} className="stat-faner">
          {FANER.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={fane === f.id}
              className="stat-faner__fane"
              onClick={() => vaelg(f.id)}
            >
              {t(f.label)}
            </button>
          ))}
        </div>
      </div>
      <div className="stat-indhold" role="tabpanel">
        {fane === 'dig' && <Dig />}
        {fane === 'holdet' && <Holdet />}
        {fane === 'barometer' && <Barometer />}
        {fane === 'rekorder' && <Rekorder />}
      </div>
    </Screen>
  );
}

/** "Denne sæson ⌄": picks which Sæson the numbers cover. */
function Periode() {
  const s = useStat();
  const [params, setParams] = useSearchParams();
  const [aaben, setAaben] = useState(false);
  if (!s.saeson) return null;
  const label = s.saeson.erSeneste ? t('stat.denneSaeson') : s.saeson.navn;

  function vaelg(id: string, erSeneste: boolean) {
    setAaben(false);
    const p = new URLSearchParams(params);
    if (erSeneste) p.delete('saeson');
    else p.set('saeson', id);
    setParams(p, { replace: true });
  }

  return (
    <>
      <button
        type="button"
        className="stat-periode"
        aria-haspopup="dialog"
        aria-label={`${label}. ${t('saeson.vaelg')}`}
        onClick={() => setAaben(true)}
      >
        {label}
        <ChevronDown size={16} strokeWidth={2.4} aria-hidden="true" />
      </button>
      <Sheet open={aaben} onOpenChange={setAaben} height="partial" title={t('saeson.vaelgTitel')}>
        <ul className="saeson-liste">
          {s.saesoner.map((x) => {
            const vises = x.id === s.saeson?.id;
            return (
              <li key={x.id}>
                <button
                  type="button"
                  className="saeson-liste__row"
                  onClick={() => vaelg(x.id, x.erSeneste)}
                  aria-current={vises ? 'true' : undefined}
                >
                  <span className={`saeson-liste__ikon${x.erSeneste ? ' saeson-liste__ikon--seneste' : ''}`} aria-hidden="true">
                    <CalendarDays size={20} strokeWidth={2} />
                  </span>
                  <span className="saeson-liste__tekst">
                    <span className="saeson-liste__navn">{x.navn}</span>
                    <span className="saeson-liste__periode">{saesonPeriode(x)}</span>
                  </span>
                  {vises && <Check className="saeson-liste__check" size={20} strokeWidth={2.6} aria-label={t('saeson.vises')} />}
                </button>
              </li>
            );
          })}
        </ul>
      </Sheet>
    </>
  );
}
