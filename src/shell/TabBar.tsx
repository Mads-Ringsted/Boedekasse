import { NavLink } from 'react-router';
import { ChartColumn, Clock, House, Menu, Plus, type LucideIcon } from 'lucide-react';
import { t, type PlainStringId } from '../strings/index.ts';
import './TabBar.css';

const tabs: Array<{ to: string; label: PlainStringId; Icon: LucideIcon } | 'fab'> = [
  { to: '/', label: 'tab.hjem', Icon: House },
  { to: '/aktivitet', label: 'tab.aktivitet', Icon: Clock },
  'fab',
  { to: '/statistik', label: 'tab.statistik', Icon: ChartColumn },
  { to: '/mere', label: 'tab.mere', Icon: Menu },
];

interface TabBarProps {
  /** Opens Giv bøder. */
  onGive: () => void;
  /** Greys out the raised + (during a Pause). */
  giveDisabled?: boolean;
}

/** Hjem · Aktivitet · raised + · Statistik · Mere. */
export function TabBar({ onGive, giveDisabled = false }: TabBarProps) {
  return (
    <nav className="tabbar" aria-label={t('tab.faner')}>
      {tabs.map((tab) =>
        tab === 'fab' ? (
          <div className="tabbar__fab-slot" key="fab">
            <button
              type="button"
              className="tabbar__fab"
              aria-label={t(giveDisabled ? 'tab.givBoederPause' : 'tab.givBoeder')}
              onClick={onGive}
              disabled={giveDisabled}
            >
              <Plus size={30} strokeWidth={2.4} aria-hidden="true" />
            </button>
          </div>
        ) : (
          <NavLink key={tab.to} to={tab.to} end={tab.to !== '/statistik'} className="tabbar__tab">
            <tab.Icon size={26} strokeWidth={2} aria-hidden="true" />
            {t(tab.label)}
          </NavLink>
        ),
      )}
    </nav>
  );
}
