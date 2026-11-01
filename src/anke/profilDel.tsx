import { useState } from 'react';
import type { Boede } from '../aktivitet/haendelse.ts';
import { kortNavne } from '../giv/navne.ts';
import { formatKr, t } from '../strings/index.ts';
import { tilbageTekst, type AnkeRegler } from './anke.ts';
import { AnkeSheet } from './AnkeSheet.tsx';
import './Anke.css';

interface KanAnkesRaekkerProps {
  /** Each Bøde you can still appeal, with the time left (see `venterPaaDig`). */
  anker: readonly { boede: Boede; msTilbage: number }[];
  regler: AnkeRegler;
  /** An Anke was sent: reload the profile. */
  onSendt: () => void;
}

/**
 * The Bøder you can appeal, in "Venter på dig" on your own profile
 * (min-profil.html): each with the time left and an "Anke" button that opens
 * the Anke sheet.
 */
export function KanAnkesRaekker({ anker, regler, onSendt }: KanAnkesRaekkerProps) {
  const [aaben, setAaben] = useState<{ nr: number; boede: Boede } | null>(null);
  return (
    <>
      {anker.map(({ boede: b, msTilbage }) => (
        <div key={b.id} className="kan-ankes__raekke">
          <span className="kan-ankes__tekst">
            <span className="kan-ankes__titel">{t('anke.kortTitel', { navn: b.navn, pris: formatKr(b.pris) })}</span>
            <span className="kan-ankes__linje">
              {t('anke.kortLinje', {
                giver: kortNavne([b.giverNavn])[0] ?? b.giverNavn,
                tid: tilbageTekst(msTilbage),
              })}
            </span>
          </span>
          <button
            type="button"
            className="kan-ankes__knap"
            onClick={() => setAaben((a) => ({ nr: (a?.nr ?? 0) + 1, boede: b }))}
          >
            {t('anke.knap')}
          </button>
        </div>
      ))}
      {aaben && (
        <AnkeSheet
          key={aaben.nr}
          open
          onOpenChange={(o) => !o && setAaben(null)}
          boede={aaben.boede}
          regler={regler}
          onSendt={onSendt}
        />
      )}
    </>
  );
}
