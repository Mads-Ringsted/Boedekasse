import { useEffect, useMemo, useRef } from 'react';
import { useBodekasse } from '../bodekasse/BodekasseProvider.tsx';
import { useGivBoeder } from '../giv/GivBoederProvider.tsx';
import { t } from '../strings/index.ts';
import { useBoedeDetalje } from './boede/BoedeDetaljeProvider.tsx';
import { FeedRaekke } from './FeedRaekke.tsx';
import { beskrivRaekke } from './raekke.ts';
import { iDag, iDage, siden } from './tid.ts';
import { useFeed } from './useFeed.ts';
import './Feed.css';

interface FeedProps {
  /** Only the entries where this Medlem gave, received or was charged (a profile's history). */
  medlemId?: string;
  /** Show this Sæson instead of the latest (a past Sæson's page, #68). */
  saesonId?: string;
}

/**
 * The Aktivitet feed of the latest Sæson: grouped by day, newest first, more
 * pages load as you scroll. Refreshes after giving Bøder or changing one.
 * Used by the Aktivitet tab and, filtered with `medlemId`, by profiles.
 */
export function Feed({ medlemId, saesonId }: FeedProps) {
  const { bodekasseId, medlemId: migId } = useBodekasse();
  const { version: givVersion } = useGivBoeder();
  const { aabn: aabnBoede, version: boedeVersion } = useBoedeDetalje();
  const feed = useFeed(bodekasseId, medlemId, [givVersion, boedeVersion], saesonId);

  const dage = useMemo(() => {
    const nu = new Date();
    const poster = feed.haendelser.flatMap((h) => {
      const raekke = beskrivRaekke(h, { migId, profilId: medlemId });
      return raekke ? [{ id: h.id, tid: h.tid, raekke, idag: iDag(h.tid, nu) }] : [];
    });
    return iDage(poster, nu);
  }, [feed.haendelser, migId, medlemId]);

  // Load the next page when the end of the list scrolls into view.
  const slut = useRef<HTMLButtonElement>(null);
  const { flere, henterFlere, hentFlere } = feed;
  useEffect(() => {
    const el = slut.current;
    if (!el || !flere || henterFlere || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && hentFlere(), {
      rootMargin: '400px',
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [flere, henterFlere, hentFlere]);

  if (feed.status === 'loading') return null;
  if (feed.status === 'error' && feed.haendelser.length === 0) {
    return (
      <button type="button" className="feed__fejl" onClick={feed.reload}>
        {t('fejl.ukendt')}
      </button>
    );
  }
  if (dage.length === 0 && !flere) {
    return (
      <div className="feed__tom">
        <span className="feed__tom-titel">{t('aktivitet.tom')}</span>
        <span className="feed__tom-tekst">{t('aktivitet.tomTekst')}</span>
      </div>
    );
  }

  return (
    <div className="feed">
      {dage.map((dag) => (
        <section key={dag.noegle} className="feed__dag" aria-label={dag.overskrift}>
          <h2 className="feed__overskrift">{dag.overskrift}</h2>
          <ul className="feed__kort">
            {dag.poster.map((p) => (
              <FeedRaekke
                key={p.id}
                raekke={p.raekke}
                tid={p.idag ? siden(p.tid) : undefined}
                onAabnBoede={aabnBoede}
              />
            ))}
          </ul>
        </section>
      ))}
      {flere && (
        <button ref={slut} type="button" className="feed__flere" disabled={henterFlere} onClick={hentFlere}>
          {t('aktivitet.visFlere')}
        </button>
      )}
    </div>
  );
}
