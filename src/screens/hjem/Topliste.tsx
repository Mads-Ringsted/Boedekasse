import type { ReactNode } from 'react';
import { Avatar } from '../../components/Avatar.tsx';
import { kortNavne } from '../../giv/navne.ts';
import { formatKr, t } from '../../strings/index.ts';
import type { OpdeltTopliste } from './topliste.ts';

interface ToplisteProps {
  topliste: OpdeltTopliste;
  /** Your Medlem id: your entry says "Dig" and is highlighted. */
  medlemId: string;
  /** Opens a Medlem's profile (#56). Without it, entries are not tappable. */
  onVaelg?: (medlemId: string) => void;
}

/** The Topliste: the top 3 on a podium (2nd, 1st, 3rd), then rows. */
export function Topliste({ topliste, medlemId, onVaelg }: ToplisteProps) {
  const alle = [...topliste.podie, ...topliste.resten];
  const kort = kortNavne(alle.map((r) => r.navn));
  const korte = new Map(alle.map((r, i) => [r.medlemId, kort[i]]));
  const navn = (id: string, n: string) => (id === medlemId ? t('medlemmer.dig') : (korte.get(id) ?? n));
  const knap = (id: string, className: string, children: ReactNode) =>
    onVaelg ? (
      <button type="button" className={className} onClick={() => onVaelg(id)}>
        {children}
      </button>
    ) : (
      <div className={className}>{children}</div>
    );

  return (
    <>
      <div className="podie">
        {topliste.podie.map((p) => (
          <div key={p.medlemId} className={`podie__plads podie__plads--${p.trin}`}>
            {knap(
              p.medlemId,
              `podie__knap${p.medlemId === medlemId ? ' podie__knap--egen' : ''}`,
              <>
                <span className="podie__avatar">
                  <Avatar navn={p.navn} size={p.trin === 1 ? 56 : 48} egen={p.medlemId === medlemId} />
                  <span className="podie__nr">{p.plads}</span>
                </span>
                <span className="podie__navn">{navn(p.medlemId, p.navn)}</span>
                <span className="podie__blok">
                  <span className="podie__beloeb">{formatKr(p.boederIAlt)}</span>
                  <span className="podie__betalt">{t('hjem.betalt', { beloeb: formatKr(p.indbetalt) })}</span>
                </span>
              </>,
            )}
          </div>
        ))}
      </div>

      {topliste.resten.length > 0 && (
        <ul className="topliste">
          {topliste.resten.map((r) => (
            <li key={r.medlemId}>
              {knap(
                r.medlemId,
                `topliste__rad${r.medlemId === medlemId ? ' topliste__rad--egen' : ''}`,
                <>
                  <span className="topliste__nr">{r.plads}</span>
                  <Avatar navn={r.navn} size={36} egen={r.medlemId === medlemId} />
                  <span className="topliste__tekst">
                    <span className="topliste__beloeb">{formatKr(r.boederIAlt)}</span>
                    <span className="topliste__under">
                      {t('hjem.toplisteRad', { navn: navn(r.medlemId, r.navn), beloeb: formatKr(r.indbetalt) })}
                    </span>
                  </span>
                </>,
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
