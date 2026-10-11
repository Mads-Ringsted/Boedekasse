import type { LucideIcon } from 'lucide-react';
import { Plus, Wallet } from 'lucide-react';
import { useGivBoeder } from '../giv/GivBoederProvider.tsx';
import { t } from '../strings/index.ts';
import type { ProfilDelProps } from './handlinger.ts';

interface ProfilKnapProps {
  label: string;
  Icon?: LucideIcon;
  /** The main-colour button (Giv bøde, Betal). */
  primaer?: boolean;
  /** A small second line, e.g. "Kun Admin". */
  under?: string;
  onClick?: () => void;
}

/** One action button on a profile. Use it for parts in `PROFIL_KNAPPER`. */
export function ProfilKnap({ label, Icon, primaer = false, under, onClick }: ProfilKnapProps) {
  return (
    <button type="button" className={`profil-knap${primaer ? ' profil-knap--primaer' : ''}`} onClick={onClick}>
      <span className="profil-knap__linje">
        {Icon && <Icon size={20} strokeWidth={2.4} aria-hidden="true" />}
        {label}
      </span>
      {under && <span className="profil-knap__under">{under}</span>}
    </button>
  );
}

/** "Giv bøde": opens Giv bøder with this person picked. */
export function GivBoedeKnap({ profil, visning }: ProfilDelProps) {
  const { aabn } = useGivBoeder();
  if (!visning.kanGiveBoede) return null;
  return <ProfilKnap primaer Icon={Plus} label={t('profil.givBoede')} onClick={() => aabn({ medlemId: profil.id })} />;
}

/** "Betal" on your own profile while you owe. */
export function BetalKnap({ visning }: ProfilDelProps) {
  if (!visning.kanBetale) return null;
  // #60 opens the Betal sheet from here (and shows a report that afventer).
  return <ProfilKnap primaer Icon={Wallet} label={t('profil.betal')} />;
}
