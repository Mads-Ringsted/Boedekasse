import { useState } from 'react';
import type { BoedeHandlingProps } from '../aktivitet/boede/handlinger.ts';
import { t } from '../strings/index.ts';
import { kanAendreAfgoerelse } from './afgoerelse.ts';
import { AfgoerelseSheet } from './AfgoerelseSheet.tsx';
import './Anke.css';

/**
 * "Ændr afgørelse" on the Bøde detail sheet (boede-aendr-afgoerelse.html):
 * for whoever recorded the verdict, or an Admin, until the next Sæson
 * starts. Opens the verdict sheet on the current verdict.
 */
export function AendrAfgoerelse({ boede, mig, iSenesteSaeson, aendret }: BoedeHandlingProps) {
  const [aabning, setAabning] = useState(0);
  if (!kanAendreAfgoerelse(boede, mig, iSenesteSaeson)) return null;
  return (
    <>
      <button type="button" className="anke-knap" onClick={() => setAabning((n) => n + 1)}>
        {t('afgoerelse.aendrKnap')}
      </button>
      <p className="anke-knap__note">{t('afgoerelse.kanAendres')}</p>
      {aabning > 0 && (
        <AfgoerelseSheet
          key={aabning}
          open
          onOpenChange={(aaben) => !aaben && setAabning(0)}
          boede={boede}
          aendr
          onAfgjort={aendret}
        />
      )}
    </>
  );
}
