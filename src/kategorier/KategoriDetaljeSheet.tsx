import { useState } from 'react';
import { useBodekasse } from '../bodekasse/BodekasseProvider.tsx';
import { Sheet } from '../components/Sheet.tsx';
import { hentFrikoeb } from '../frikob/hentFrikoeb.ts';
import { useGivBoeder } from '../giv/GivBoederProvider.tsx';
import { navneliste } from '../giv/tekst.ts';
import { kortNavne } from '../giv/navne.ts';
import { useSaeson } from '../saeson/SaesonProvider.tsx';
import { formatKr, t } from '../strings/index.ts';
import { supabase } from '../supabase/index.ts';
import { rpcErrorText } from '../supabase/rpcErrors.ts';
import { useHent } from '../supabase/useHent.ts';
import type { Kategori } from './hentKategorier.ts';
import { kanRette, kortDato } from './kategoriListe.ts';

interface KategoriDetaljeSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kategori: Kategori;
  onRediger: () => void;
  /** Archived or brought back; reload the list. */
  onAendret: () => void;
}

/**
 * Bødekategori detail: price, tags, description, Oprettet af and Brugt.
 * "Giv denne bøde" opens Giv bøder with it pre-selected.
 * The creator and Admins get Redigér and Arkivér, or Gendan when archived.
 * Mount it with a new `key` per opening so the one-time ID starts fresh.
 */
export function KategoriDetaljeSheet({ open, onOpenChange, kategori, onRediger, onAendret }: KategoriDetaljeSheetProps) {
  const mig = useBodekasse();
  const { aabn: givBoeder } = useGivBoeder();
  const { pause } = useSaeson();
  const [busy, setBusy] = useState(false);
  const [fejl, setFejl] = useState<string | null>(null);
  const [klientId] = useState(() => crypto.randomUUID());
  const maaRette = kanRette(kategori, mig);
  const frikoeb = useHent(
    () => hentFrikoeb(mig.bodekasseId, { bodekategoriId: kategori.id }),
    [mig.bodekasseId, kategori.id],
  );
  const holdere = frikoeb.status === 'ready' ? kortNavne(frikoeb.data.map((f) => f.medlemNavn)) : [];

  async function skift(rpc: 'arkiver_bodekategori' | 'gendan_bodekategori') {
    setBusy(true);
    setFejl(null);
    const { error } = await supabase.rpc(rpc, { p_klient_id: klientId, p_bodekategori: kategori.id });
    setBusy(false);
    if (error) {
      setFejl(rpcErrorText(error));
      return;
    }
    onAendret();
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange} height="partial" title={kategori.navn}>
      <div className="kategori-detalje">
        <div className="kategori-detalje__top">
          <span className="kategori-detalje__tags">
            {kategori.arkiveret ? (
              <span className="kategori-tag kategori-tag--graa">{t('kategori.arkiveret')}</span>
            ) : (
              kategori.ofteBrugt && <span className="kategori-tag">{t('kategorier.ofteBrugt')}</span>
            )}
          </span>
          <span className="kategori-detalje__pris">{formatKr(kategori.pris)}</span>
        </div>

        {kategori.beskrivelse && <p className="kategori-detalje__beskrivelse">{kategori.beskrivelse}</p>}

        <dl className="kategori-detalje__info">
          <div className="kategori-detalje__raekke">
            <dt>{t('kategori.oprettetAf')}</dt>
            <dd>
              {t('kategori.oprettetAfVaerdi', { navn: kategori.oprettetAfNavn, dato: kortDato(kategori.oprettet) })}
            </dd>
          </div>
          <div className="kategori-detalje__raekke">
            <dt>{t('kategori.brugt')}</dt>
            <dd>{kategori.antal === 1 ? t('kategori.gang') : t('kategori.gange', { antal: kategori.antal })}</dd>
          </div>
          {holdere.length > 0 && (
            <div className="kategori-detalje__raekke">
              <dt>{t('kategori.frikob')}</dt>
              <dd>{navneliste(holdere)}</dd>
            </div>
          )}
        </dl>

        {fejl && (
          <p className="kategori-detalje__fejl" role="alert">
            {fejl}
          </p>
        )}

        {!kategori.arkiveret && !pause && (
          <button
            type="button"
            className="kategori-detalje__giv"
            onClick={() => {
              onOpenChange(false);
              givBoeder({ kategoriId: kategori.id });
            }}
          >
            {t('giv.denneBoede')}
          </button>
        )}

        {maaRette &&
          (kategori.arkiveret ? (
            <button
              type="button"
              className="kategori-detalje__knap"
              disabled={busy}
              onClick={() => void skift('gendan_bodekategori')}
            >
              {t('kategori.gendan')}
            </button>
          ) : (
            <div className="kategori-detalje__knapper">
              <button type="button" className="kategori-detalje__knap" disabled={busy} onClick={onRediger}>
                {t('kategori.rediger')}
              </button>
              <button
                type="button"
                className="kategori-detalje__knap kategori-detalje__knap--fare"
                disabled={busy}
                onClick={() => void skift('arkiver_bodekategori')}
              >
                {t('kategori.arkiver')}
              </button>
            </div>
          ))}
      </div>
    </Sheet>
  );
}
