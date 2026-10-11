import { useState, type ComponentType } from 'react';
import { ArrowUpRight, CalendarDays, ChevronDown, Tag as TagIkon, Trophy } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router';
import { Avatar } from '../components/Avatar.tsx';
import { TagMaerke } from './TagMaerke.tsx';
import type { Ikon, Raekke, Symbol } from './visning.ts';

/** The icon for each `Symbol`. Add one here when a new kind needs it. */
const SYMBOLER: Record<Symbol, ComponentType<{ size?: number; strokeWidth?: number }>> = {
  kategori: TagIkon,
  saeson: CalendarDays,
  trofae: Trophy,
  haevning: ArrowUpRight,
};

function RaekkeIkon({ ikon }: { ikon: Ikon }) {
  if (ikon.slags === 'avatar') return <Avatar navn={ikon.navn} size={40} egen={ikon.egen} />;
  const Symbol = SYMBOLER[ikon.symbol];
  return (
    <span className={`feed-raekke__symbol feed-raekke__symbol--${ikon.tone ?? 'graa'}`} aria-hidden="true">
      <Symbol size={20} strokeWidth={2} />
    </span>
  );
}

interface FeedRaekkeProps {
  raekke: Raekke;
  /** Appended to the second line, e.g. "35 min" for today's rows. */
  tid?: string;
  onAabnBoede: (boedeId: string) => void;
  /** Admins only: a row with `annullerGebyr` opens "Annullér gebyr". */
  onAnnullerGebyr?: (raekke: Raekke) => void;
}

/**
 * One feed row, drawn from its description: icon, title with tag, second
 * line, amount with any Gebyr under it. A batch of Bøder expands; a single
 * Bøde opens its detail sheet.
 */
export function FeedRaekke({ raekke, tid, onAabnBoede, onAnnullerGebyr }: FeedRaekkeProps) {
  const [aaben, setAaben] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { boeder, boedeId, link } = raekke;
  const linje = [raekke.linje, tid].filter(Boolean).join(' · ');

  const indhold = (
    <>
      <RaekkeIkon ikon={raekke.ikon} />
      <span className="feed-raekke__tekst">
        <span className="feed-raekke__titel">
          <span className="feed-raekke__titel-tekst">{raekke.titel}</span>
          {raekke.tag && <TagMaerke tag={raekke.tag} />}
        </span>
        {linje && <span className="feed-raekke__linje">{linje}</span>}
      </span>
      {(raekke.beloeb || raekke.gebyr || boeder) && (
        <span className="feed-raekke__hoejre">
          <span className="feed-raekke__beloeb-linje">
            {raekke.beloeb && (
              <span className={`feed-raekke__beloeb${raekke.beloeb.tone === 'groen' ? ' feed-raekke__beloeb--groen' : ''}`}>
                {raekke.beloeb.tekst}
              </span>
            )}
            {boeder && (
              <ChevronDown className="feed-raekke__chevron" size={16} strokeWidth={2.4} aria-hidden="true" />
            )}
          </span>
          {raekke.gebyr && <span className="feed-raekke__gebyr">{raekke.gebyr}</span>}
        </span>
      )}
    </>
  );

  const klasse = `feed-raekke${raekke.annulleret ? ' feed-raekke--annulleret' : ''}${aaben ? ' feed-raekke--aaben' : ''}`;

  if (boeder) {
    return (
      <li className="feed__post">
        <button type="button" className={klasse} aria-expanded={aaben} onClick={() => setAaben((a) => !a)}>
          {indhold}
        </button>
        {aaben && (
          <ul className="feed-raekke__boeder">
            {boeder.map((b) => (
              <li key={b.id}>
                <button
                  type="button"
                  className={`feed-boede${b.annulleret ? ' feed-boede--annulleret' : ''}`}
                  onClick={() => onAabnBoede(b.id)}
                >
                  <span className="feed-boede__navn">
                    <span className="feed-raekke__titel-tekst">{b.navn}</span>
                    {b.tag && <TagMaerke tag={b.tag} />}
                  </span>
                  <span className="feed-raekke__hoejre">
                    <span className="feed-boede__beloeb">{b.beloeb}</span>
                    {b.gebyr && <span className="feed-raekke__gebyr">{b.gebyr}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </li>
    );
  }

  return (
    <li className="feed__post">
      {/* Admins: a Gebyr to annul wins over opening the Bøde (an Anke row has both). */}
      {raekke.annullerGebyr && onAnnullerGebyr ? (
        <button type="button" className={klasse} onClick={() => onAnnullerGebyr(raekke)}>
          {indhold}
        </button>
      ) : boedeId ? (
        <button type="button" className={klasse} onClick={() => onAabnBoede(boedeId)}>
          {indhold}
        </button>
      ) : link ? (
        <button type="button" className={klasse} onClick={() => void navigate(link, { state: { fra: pathname } })}>
          {indhold}
        </button>
      ) : (
        <div className={klasse}>{indhold}</div>
      )}
    </li>
  );
}
