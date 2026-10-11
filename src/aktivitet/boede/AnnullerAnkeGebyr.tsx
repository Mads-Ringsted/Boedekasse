import { useState } from 'react';
import { t } from '../../strings/index.ts';
import { AnnullerGebyrSheet } from './AnnullerGebyrSheet.tsx';
import { kanAnnullereAnkeGebyr } from './annuller.ts';
import type { BoedeHandlingProps } from './handlinger.ts';
import './Annuller.css';

/**
 * "Annullér ankegebyr" on the Bøde detail sheet (#62/#63): an Admin annuls
 * the receiver's Anke Gebyr. It opens the same sheet as a feed row's Gebyr.
 */
export function AnnullerAnkeGebyr({ boede, mig, iSenesteSaeson, aendret }: BoedeHandlingProps) {
  const [aabning, setAabning] = useState(0);
  if (!kanAnnullereAnkeGebyr(boede, mig, iSenesteSaeson) || !boede.ankeGebyrId || boede.ankeGebyr === null) {
    return null;
  }
  return (
    <>
      <button type="button" className="annuller__knap annuller__knap--ankegebyr" onClick={() => setAabning((n) => n + 1)}>
        {t('annuller.ankeGebyrKnap')}
      </button>
      {aabning > 0 && (
        <AnnullerGebyrSheet
          key={aabning}
          open
          onOpenChange={(aaben) => !aaben && setAabning(0)}
          gebyr={{
            id: boede.ankeGebyrId,
            art: 'anke',
            beloeb: boede.ankeGebyr,
            medlemId: boede.modtagerId,
            medlemNavn: boede.modtagerNavn,
            annullering: null,
          }}
          titel={t('annuller.ankeGebyrTitel', { navn: boede.navn })}
          onAnnulleret={aendret}
        />
      )}
    </>
  );
}
