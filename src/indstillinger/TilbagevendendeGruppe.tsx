import { useState } from 'react';
import { useBodekasse } from '../bodekasse/BodekasseProvider.tsx';
import { kortDato } from '../kategorier/kategoriListe.ts';
import { formatKr, t } from '../strings/index.ts';
import { rpcErrorText } from '../supabase/rpcErrors.ts';
import { useHent } from '../supabase/useHent.ts';
import { hentTilbagevendende } from './hentTilbagevendende.ts';
import { Gruppe, LinkRaekke } from './raekker.tsx';
import { frekvensTekst, naesteForekomst, type TilbagevendendeGebyr } from './tilbagevendende.ts';
import { TilbagevendendeSheet } from './TilbagevendendeSheet.tsx';
import './Indstillinger.css';

/**
 * The settings card of Tilbagevendende Gebyrer (#79): one row per running
 * Tilbagevendende Gebyr (tap to edit or stop it) and a row to make a new one. Admin only, like
 * the screen it sits on.
 */
export function TilbagevendendeGruppe() {
  const { bodekasseId } = useBodekasse();
  const hentet = useHent(() => hentTilbagevendende(bodekasseId), [bodekasseId]);
  // Each opening mounts a fresh sheet (new one-time IDs); `tilbagevendende` null = Nyt.
  const [sheet, setSheet] = useState<{
    n: number;
    open: boolean;
    tilbagevendende: TilbagevendendeGebyr | null;
  } | null>(null);

  function aabn(tilbagevendende: TilbagevendendeGebyr | null) {
    setSheet((s) => ({ n: (s?.n ?? 0) + 1, open: true, tilbagevendende }));
  }

  return (
    <>
      <Gruppe titel={t('indstillinger.gebyrerTilbagevendende')}>
        {hentet.status === 'error' && (
          <button type="button" className="indst__fejl indst-raekke" onClick={hentet.reload}>
            {rpcErrorText(hentet.error)} · {t('handling.proevIgen')}
          </button>
        )}
        {hentet.status === 'ready' &&
          hentet.data.tilbagevendende.map((r) => (
            <LinkRaekke
              key={r.id}
              label={r.navn}
              under={t('indstillinger.tilbagevendendeUnder', {
                beloeb: formatKr(r.beloeb),
                frekvens: frekvensTekst(r.frekvens, r.dag),
                naeste: kortDato(`${naesteForekomst(r.frekvens, r.dag)}T12:00:00Z`),
              })}
              onClick={() => aabn(r)}
            />
          ))}
        {hentet.status === 'ready' && (
          <LinkRaekke label={t('indstillinger.tilbagevendendeNy')} art="handling" onClick={() => aabn(null)} />
        )}
      </Gruppe>

      {sheet && hentet.status === 'ready' && (
        <TilbagevendendeSheet
          key={sheet.n}
          open={sheet.open}
          onOpenChange={(open) => setSheet((s) => s && { ...s, open })}
          {...(sheet.tilbagevendende ? { tilbagevendende: sheet.tilbagevendende } : {})}
          medlemmer={hentet.data.medlemmer}
          onGemt={() => {
            setSheet((s) => s && { ...s, open: false });
            hentet.reload();
          }}
        />
      )}
    </>
  );
}
