import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { Avatar } from '../components/Avatar.tsx';
import { t } from '../strings/index.ts';
import { useStat } from './StatistikData.tsx';

/** A Medlem's avatar: your own in the main colour, an Udmeldt one grey. */
export function StatAvatar({ medlemId, size }: { medlemId: string; size: number }) {
  const s = useStat();
  const navn = s.medlemmer.find((m) => m.id === medlemId)?.navn ?? '';
  return <Avatar navn={navn} size={size} medlemId={medlemId} egen={medlemId === s.migId} tidligere={s.erUdmeldt(medlemId)} />;
}

/** A card, optionally a button. */
export function Kort({
  children,
  onClick,
  className = '',
  label,
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  label?: string;
}) {
  return onClick ? (
    <button type="button" className={`stat-kort ${className}`} onClick={onClick} aria-label={label}>
      {children}
    </button>
  ) : (
    <div className={`stat-kort ${className}`}>{children}</div>
  );
}

/** A card heading, with "Sammenlign ›" when the card opens a page. */
export function KortTitel({ titel, ekstra, sammenlign = false }: { titel: string; ekstra?: ReactNode; sammenlign?: boolean }) {
  return (
    <span className="stat-kort__titel">
      <span className="stat-kort__titel-tekst">{titel}</span>
      {sammenlign && (
        <span className="stat-kort__link">
          {t('stat.sammenlign')}
          <ChevronRight size={16} strokeWidth={2.2} aria-hidden="true" />
        </span>
      )}
      {ekstra !== undefined && <span className="stat-kort__ekstra">{ekstra}</span>}
    </span>
  );
}

/** A simple horizontal bar: label, bar, number. */
export function Bjaelke({
  label,
  antal,
  max,
  farve = 'rose',
  bred = false,
}: {
  label: ReactNode;
  antal: number;
  max: number;
  farve?: 'rose' | 'blaa';
  bred?: boolean;
}) {
  return (
    <span className={`stat-bjaelke${bred ? ' stat-bjaelke--bred' : ''}`}>
      <span className="stat-bjaelke__label">{label}</span>
      <span className="stat-bjaelke__spor">
        <span className={`stat-bjaelke__fyld stat-farve--${farve}`} style={{ width: `${pct(antal, max)}%` }} />
      </span>
      <span className="stat-bjaelke__tal">{antal}</span>
    </span>
  );
}

/** A butterfly chart row: what you gave on the left, what you got on the right. */
export function Sommerfugl({
  midte,
  gav,
  fik,
  max,
  bred = false,
}: {
  midte: ReactNode;
  gav: number;
  fik: number;
  max: number;
  bred?: boolean;
}) {
  return (
    <div className={`stat-sommerfugl${bred ? ' stat-sommerfugl--bred' : ''}`}>
      <span className="stat-sommerfugl__venstre">
        {gav > 0 ? (
          <>
            {gav}
            <span className="stat-sommerfugl__bar stat-farve--blaa" style={{ width: `${pct(gav, max)}%` }} />
          </>
        ) : (
          <span className="stat-sommerfugl__nul">0</span>
        )}
      </span>
      <span className="stat-sommerfugl__midte">{midte}</span>
      <span className="stat-sommerfugl__hoejre">
        {fik > 0 ? (
          <>
            <span className="stat-sommerfugl__bar stat-farve--rose" style={{ width: `${pct(fik, max)}%` }} />
            {fik}
          </>
        ) : (
          <span className="stat-sommerfugl__nul">0</span>
        )}
      </span>
    </div>
  );
}

export function SommerfuglHoved({ venstre, hoejre, bred = false }: { venstre: string; hoejre: string; bred?: boolean }) {
  return (
    <div className={`stat-sommerfugl stat-sommerfugl--hoved${bred ? ' stat-sommerfugl--bred' : ''}`}>
      <span className="stat-tekst--blaa" style={{ textAlign: 'right' }}>
        {venstre}
      </span>
      <span />
      <span className="stat-tekst--rose">{hoejre}</span>
    </div>
  );
}

/** A quiet line for a card with nothing to show yet. */
export function Tom({ children }: { children: ReactNode }) {
  return <p className="stat-tom">{children}</p>;
}

export const pct = (v: number, max: number) => (max > 0 ? Math.max(4, Math.round((v / max) * 100)) : 0);

/** "1,6" — one decimal, Danish comma, no trailing ",0". */
export const decimal = (v: number) => String(Math.round(v * 10) / 10).replace('.', ',');
