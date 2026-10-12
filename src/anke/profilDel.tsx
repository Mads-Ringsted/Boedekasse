import { useState } from 'react';
import type { Boede } from '../aktivitet/haendelse.ts';
import { useBodekasse } from '../bodekasse/BodekasseProvider.tsx';
import { kortNavne } from '../giv/navne.ts';
import type { ProfilDelProps } from '../profil/handlinger.ts';
import { formatKr, t } from '../strings/index.ts';
import { useHent } from '../supabase/useHent.ts';
import { ankeVindue, tilbageTekst } from './anke.ts';
import { AnkeSheet } from './AnkeSheet.tsx';
import { hentKanAnkes } from './hentAnke.ts';
import './Anke.css';

/**
 * "Kan ankes" on your own profile (min-profil.html): each Bøde you can still
 * appeal, with the time left and an "Anke" button that opens the Anke sheet.
 * Hidden when there is none.
 */
export function KanAnkesKort({ profil, visning, opdater }: ProfilDelProps) {
  const { bodekasseId } = useBodekasse();
  // `profil` is a new object after every profile reload.
  const hentet = useHent(
    () => (visning.egen ? hentKanAnkes(bodekasseId, profil.id) : Promise.resolve(null)),
    [bodekasseId, profil, visning.egen],
  );
  const [anker, setAnker] = useState<{ nr: number; boede: Boede } | null>(null);
  if (!visning.egen || hentet.status !== 'ready' || !hentet.data || hentet.data.boeder.length === 0) return null;
  const { regler, boeder } = hentet.data;
  const nu = new Date();

  return (
    <>
      <h2 className="profil__sektion">{t('anke.kanAnkes')}</h2>
      <div>
        {boeder.map((b) => {
          const vindue = ankeVindue(b, profil.id, regler, nu);
          if (!vindue) return null;
          return (
            <div key={b.id} className="kan-ankes__raekke">
              <span className="kan-ankes__tekst">
                <span className="kan-ankes__titel">{t('anke.kortTitel', { navn: b.navn, pris: formatKr(b.pris) })}</span>
                <span className="kan-ankes__linje">
                  {t('anke.kortLinje', {
                    giver: kortNavne([b.giverNavn])[0] ?? b.giverNavn,
                    tid: tilbageTekst(vindue.msTilbage),
                  })}
                </span>
              </span>
              <button
                type="button"
                className="kan-ankes__knap"
                onClick={() => setAnker((a) => ({ nr: (a?.nr ?? 0) + 1, boede: b }))}
              >
                {t('anke.knap')}
              </button>
            </div>
          );
        })}
      </div>
      {anker && (
        <AnkeSheet
          key={anker.nr}
          open
          onOpenChange={(aaben) => !aaben && setAnker(null)}
          boede={anker.boede}
          regler={regler}
          onSendt={opdater}
        />
      )}
    </>
  );
}
