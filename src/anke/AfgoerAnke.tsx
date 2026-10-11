import { useState } from 'react';
import type { BoedeHandlingProps } from '../aktivitet/boede/handlinger.ts';
import { hvemObjekt } from '../aktivitet/navne.ts';
import { t } from '../strings/index.ts';
import { kanRegistrereAfgoerelse, partIAnken } from './afgoerelse.ts';
import { AfgoerelseSheet } from './AfgoerelseSheet.tsx';
import './Anke.css';
import './Afgoerelse.css';

/**
 * On the Bøde detail sheet for an Anket Bøde (#64): "Registrér gruppens
 * afgørelse" for anyone but the giver and the receiver (opens the verdict
 * sheet on top), and a note for the two involved that the group decides.
 */
export function AfgoerAnke({ boede, mig, iSenesteSaeson, aendret }: BoedeHandlingProps) {
  const [aabning, setAabning] = useState(0);

  if (partIAnken(boede, mig)) {
    const anden = mig.medlemId === boede.giverId ? boede.modtagerId : boede.giverId;
    const andenNavn = mig.medlemId === boede.giverId ? boede.modtagerNavn : boede.giverNavn;
    return (
      <p className="afgoerelse-part">
        {t('afgoerelse.part', { anden: hvemObjekt(anden, andenNavn, { migId: mig.medlemId }) })}
      </p>
    );
  }
  if (!kanRegistrereAfgoerelse(boede, mig, iSenesteSaeson)) return null;

  return (
    <>
      <button type="button" className="afgoerelse__knap" onClick={() => setAabning((n) => n + 1)}>
        {t('afgoerelse.registrer')}
      </button>
      {aabning > 0 && (
        <AfgoerelseSheet
          key={aabning}
          open
          onOpenChange={(aaben) => !aaben && setAabning(0)}
          boede={boede}
          onAfgjort={aendret}
        />
      )}
    </>
  );
}
