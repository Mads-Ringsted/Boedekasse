import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Plus, Wallet } from 'lucide-react';
import { BetalSheet } from '../betal/BetalSheet.tsx';
import { useGivBoeder } from '../giv/GivBoederProvider.tsx';
import { RegistrerIndbetalingSheet } from '../kassen/RegistrerIndbetalingSheet.tsx';
import { useSaeson } from '../saeson/SaesonProvider.tsx';
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

/**
 * "Giv bøde": opens Giv bøder with this person picked (you too, on your own
 * profile, where Betal stays the main button). Hidden in a Pause.
 */
export function GivBoedeKnap({ profil, visning }: ProfilDelProps) {
  const { aabn } = useGivBoeder();
  const { pause } = useSaeson();
  if (!visning.kanGiveBoede || pause) return null;
  return (
    <ProfilKnap
      primaer={!visning.egen}
      Icon={Plus}
      label={t('profil.givBoede')}
      onClick={() => aabn({ medlemId: profil.id })}
    />
  );
}

/** "Betal" on your own profile while you owe: opens the Betal sheet. */
export function BetalKnap({ visning, opdater }: ProfilDelProps) {
  // Each opening mounts a fresh sheet (new one-time ID).
  const [aabning, setAabning] = useState(0);
  if (!visning.kanBetale) return null;
  return (
    <>
      <ProfilKnap primaer Icon={Wallet} label={t('profil.betal')} onClick={() => setAabning((n) => n + 1)} />
      {aabning > 0 && (
        <BetalSheet key={aabning} open onOpenChange={(aaben) => !aaben && setAabning(0)} onAendret={opdater} />
      )}
    </>
  );
}

/** "Registrér indbetaling" (Admin or Kasserer) on someone else's profile, with them picked. */
export function RegistrerIndbetalingKnap({ profil, visning, mig, opdater }: ProfilDelProps) {
  // Each opening mounts a fresh sheet (new one-time ID).
  const [aabning, setAabning] = useState(0);
  if (!mig.kanHaandterePenge || visning.egen) return null;
  return (
    <>
      <ProfilKnap
        label={t('kassen.registrer')}
        under={t('profil.kunPenge')}
        onClick={() => setAabning((n) => n + 1)}
      />
      {aabning > 0 && (
        <RegistrerIndbetalingSheet
          key={aabning}
          open
          onOpenChange={(aaben) => !aaben && setAabning(0)}
          medlemId={profil.id}
          onRegistreret={opdater}
        />
      )}
    </>
  );
}
