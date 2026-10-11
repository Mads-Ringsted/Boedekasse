import { useState } from 'react';
import { Scale } from 'lucide-react';
import type { BoedeHandlingProps } from '../aktivitet/boede/handlinger.ts';
import { formatKr, t } from '../strings/index.ts';
import { ankeVindue, gebyrInterval, kronerUdenKr } from './anke.ts';
import { AnkeSheet } from './AnkeSheet.tsx';
import './Anke.css';

/**
 * "Anke bøden" on the Bøde detail sheet (boede-detalje.html): for the
 * receiver while the Anke window is open (`ankeVindue`), with the Gebyr range
 * under it. Opens the Anke sheet on top. The detail sheet reloads only when
 * the Anke sheet closes, so the wheel isn't cut short.
 */
export function AnkeBoede({ boede, mig, ankeRegler, aendret }: BoedeHandlingProps) {
  const [aabning, setAabning] = useState(0);
  if (!ankeRegler || !ankeVindue(boede, mig.medlemId, ankeRegler)) return null;
  const { min, max } = gebyrInterval(boede.pris, ankeRegler);
  return (
    <>
      <button type="button" className="anke-knap" onClick={() => setAabning((n) => n + 1)}>
        <Scale size={20} strokeWidth={2} aria-hidden="true" />
        {t('anke.ankeBoeden')}
      </button>
      <p className="anke-knap__note">{t('anke.koster', { min: kronerUdenKr(min), max: formatKr(max) })}</p>
      {aabning > 0 && (
        <AnkeSheet
          key={aabning}
          open
          onOpenChange={(aaben) => !aaben && setAabning(0)}
          boede={boede}
          regler={ankeRegler}
          stacked
          onSendt={aendret}
        />
      )}
    </>
  );
}
