import { useBodekasse } from '../../bodekasse/BodekasseProvider.tsx';
import { Sheet } from '../../components/Sheet.tsx';
import { formatKr, t } from '../../strings/index.ts';
import { supabase } from '../../supabase/index.ts';
import type { Gebyr } from '../haendelse.ts';
import { hvemObjekt } from '../navne.ts';
import { AnnullerKnap, AnnullerNote, useAnnuller } from './AnnullerFelt.tsx';

interface AnnullerGebyrSheetProps {
  gebyr: Gebyr;
  /** What the Gebyr was for, e.g. the feed row's title. */
  titel: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAnnulleret: () => void;
}

/**
 * Annul a single Gebyr from its feed row, with an optional note. Mirrors
 * `annuller_gebyr` (and `maaAnnullereGebyr`):
 * - an Admin: a creation (#62), Anke (#62), Catch-up (#78) or Tilbagevendende
 *   (#79) Gebyr;
 * - an Admin or a Kasserer: a single late day of Sen betaling (#80) or a
 *   Dos-bonus (#77, spec #74 review).
 * Mount with a fresh `key` per opening.
 */
export function AnnullerGebyrSheet({ gebyr, titel, open, onOpenChange, onAnnulleret }: AnnullerGebyrSheetProps) {
  const { medlemId } = useBodekasse();
  const a = useAnnuller(
    (klientId, note) => supabase.rpc('annuller_gebyr', { p_klient_id: klientId, p_gebyr: gebyr.id, p_note: note }),
    () => {
      onOpenChange(false);
      onAnnulleret();
    },
  );
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      height="partial"
      title={t('annuller.gebyrTitel')}
      dirty={a.note !== ''}
      footer={<AnnullerKnap a={a} knap="annuller.gebyr" />}
    >
      <p className="annuller-gebyr__linje">{titel}</p>
      <div className="annuller-gebyr__top">
        <span className="annuller-gebyr__navn">
          {t('annuller.gebyrLinje', { hvem: hvemObjekt(gebyr.medlemId, gebyr.medlemNavn, { migId: medlemId }) })}
        </span>
        <span className="annuller-gebyr__beloeb">{formatKr(gebyr.beloeb)}</span>
      </div>
      <AnnullerNote a={a} />
    </Sheet>
  );
}
