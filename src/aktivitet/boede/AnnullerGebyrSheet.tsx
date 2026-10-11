import { useBodekasse } from '../../bodekasse/BodekasseProvider.tsx';
import { Sheet } from '../../components/Sheet.tsx';
import { formatKr, t } from '../../strings/index.ts';
import { supabase } from '../../supabase/index.ts';
import type { Gebyr } from '../haendelse.ts';
import { hvemObjekt } from '../navne.ts';
import { AnnullerFelt } from './AnnullerFelt.tsx';

interface AnnullerGebyrSheetProps {
  gebyr: Gebyr;
  /** What the Gebyr was for, e.g. the feed row's title. */
  titel: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAnnulleret: () => void;
}

/**
 * Admin: annul a single creation or Anke Gebyr from its feed row (#62), with
 * an optional note. Mount with a fresh `key` per opening.
 */
export function AnnullerGebyrSheet({ gebyr, titel, open, onOpenChange, onAnnulleret }: AnnullerGebyrSheetProps) {
  const { medlemId } = useBodekasse();
  return (
    <Sheet open={open} onOpenChange={onOpenChange} height="partial" title={t('annuller.gebyrTitel')}>
      <p className="annuller-gebyr__linje">{titel}</p>
      <div className="annuller-gebyr__top">
        <span className="annuller-gebyr__navn">
          {t('annuller.gebyrLinje', { hvem: hvemObjekt(gebyr.medlemId, gebyr.medlemNavn, { migId: medlemId }) })}
        </span>
        <span className="annuller-gebyr__beloeb">{formatKr(gebyr.beloeb)}</span>
      </div>
      <AnnullerFelt
        knap="annuller.gebyr"
        annuller={(klientId, note) =>
          supabase.rpc('annuller_gebyr', { p_klient_id: klientId, p_gebyr: gebyr.id, p_note: note })
        }
        onAnnulleret={() => {
          onOpenChange(false);
          onAnnulleret();
        }}
      />
    </Sheet>
  );
}
