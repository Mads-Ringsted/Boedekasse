import { useState } from 'react';
import { Plus, Trophy } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router';
import { useBodekasse } from '../bodekasse/BodekasseProvider.tsx';
import { BackButton } from '../components/BackButton.tsx';
import { Screen } from '../components/Screen.tsx';
import { kortNavne } from '../giv/navne.ts';
import { TagMaerke } from '../aktivitet/TagMaerke.tsx';
import { formatKr, t } from '../strings/index.ts';
import { rpcErrorText } from '../supabase/rpcErrors.ts';
import { useHent } from '../supabase/useHent.ts';
import { hentKonkurrencer } from './hentKonkurrencer.ts';
import { konkurrenceDato, type Konkurrence } from './konkurrence.ts';
import { KonkurrenceSheet } from './KonkurrenceSheet.tsx';
import './Konkurrence.css';

/**
 * Mere → Konkurrencer: the latest Sæson's Konkurrencer, newest first, each
 * with its date, placed/absent counts, total and top 3. + opens Ny
 * konkurrence (not in a Pause). Hidden when Konkurrence is switched off.
 */
export function Konkurrencer() {
  const { bodekasseId, medlemId } = useBodekasse();
  const navigate = useNavigate();
  const hentet = useHent(() => hentKonkurrencer(bodekasseId), [bodekasseId]);
  const [ny, setNy] = useState<{ n: number; open: boolean } | null>(null);

  const data = hentet.status === 'ready' ? hentet.data : null;
  if (data && !data.regler.til) return <Navigate to="/mere" replace />;
  const pause = data !== null && data.regler.aktivSaesonId === null;

  const aabn = (id: string) => void navigate(`/konkurrencer/${id}`, { state: { fra: '/konkurrencer' } });

  return (
    <Screen>
      <BackButton label={t('tab.mere')} onClick={() => void navigate('/mere')} />
      <div className="konk__top">
        <h1 className="screen__title">{t('mere.konkurrencer')}</h1>
        {data && !pause && (
          <button
            type="button"
            className="konk__ny"
            aria-label={t('konkurrencer.ny')}
            onClick={() => setNy((s) => ({ n: (s?.n ?? 0) + 1, open: true }))}
          >
            <Plus size={22} strokeWidth={2.4} aria-hidden="true" />
          </button>
        )}
      </div>

      {hentet.status === 'error' && (
        <button type="button" className="konk__fejl" onClick={hentet.reload}>
          {rpcErrorText(hentet.error)} · {t('handling.proevIgen')}
        </button>
      )}
      {pause && <p className="konk__note">{t('konkurrencer.pause')}</p>}

      {data && data.konkurrencer.length === 0 && !pause && (
        <div className="konk__tom">
          <span className="konk__tom-titel">{t('konkurrencer.tom')}</span>
          <span className="konk__tom-tekst">{t('konkurrencer.tomTekst')}</span>
        </div>
      )}

      {data?.konkurrencer.map((k, i) => (
        <KonkurrenceKort key={k.id} k={k} nyeste={i === 0} medlemId={medlemId} onClick={() => aabn(k.id)} />
      ))}

      {ny && (
        <KonkurrenceSheet
          key={ny.n}
          open={ny.open}
          onOpenChange={(open) => setNy((s) => s && { ...s, open })}
          onGemt={(id) => {
            setNy((s) => s && { ...s, open: false });
            aabn(id);
          }}
        />
      )}
    </Screen>
  );
}

function KonkurrenceKort({
  k,
  nyeste,
  medlemId,
  onClick,
}: {
  k: Konkurrence;
  nyeste: boolean;
  medlemId: string;
  onClick: () => void;
}) {
  const top = k.resultat.filter((d) => d.plads !== null && d.plads <= 3).slice(0, 3);
  const korte = kortNavne(top.map((d) => d.navn));
  const annulleret = k.annullering !== null;
  return (
    <button type="button" className={`konk-kort${annulleret ? ' konk-kort--annulleret' : ''}`} onClick={onClick}>
      <span className="konk-kort__hoved">
        <span className={`konk-kort__ikon${nyeste && !annulleret ? ' konk-kort__ikon--nyeste' : ''}`} aria-hidden="true">
          <Trophy size={20} strokeWidth={2} />
        </span>
        <span className="konk-kort__tekst">
          <span className="konk-kort__titel">
            <span className="konk-kort__titel-tekst">{k.titel}</span>
            {annulleret && <TagMaerke tag={{ tekst: t('boede.tag.annulleret'), tone: 'graa' }} />}
          </span>
          <span className="konk-kort__linje">
            {t('konkurrencer.listeLinje', {
              dato: konkurrenceDato(k.dato, true),
              placeret: k.antalPlaceret,
              fravaerende: k.antalFravaerende,
            })}
          </span>
        </span>
        <span className="konk-kort__beloeb">{formatKr(k.total)}</span>
      </span>
      {top.length > 0 && (
        <span className="konk-kort__top">
          {top.map((d, i) => (
            <span key={d.medlemId} className="konk-kort__plads">
              <span className={`konk-kort__nr${d.plads === 1 ? ' konk-kort__nr--1' : ''}`}>{d.plads}</span>
              {d.medlemId === medlemId ? t('medlemmer.dig') : korte[i]}
            </span>
          ))}
        </span>
      )}
    </button>
  );
}
