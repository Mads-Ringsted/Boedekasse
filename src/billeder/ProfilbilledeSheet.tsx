import { useRef, useState, type ChangeEvent } from 'react';
import { useBodekasse, useMedlemskaber } from '../bodekasse/BodekasseProvider.tsx';
import { Avatar } from '../components/Avatar.tsx';
import { Sheet } from '../components/Sheet.tsx';
import { SheetAction } from '../components/SheetAction.tsx';
import { t } from '../strings/index.ts';
import { rpcErrorText } from '../supabase/rpcErrors.ts';
import { midterKvadrat, type Kvadrat } from './beskaering.ts';
import { useBilleder } from './BilledProvider.tsx';
import { andreKasser, kopiStier } from './billede.ts';
import { fjernMitBillede, kopierMitBillede, saetMitBillede, sletUpload, uploadBillede } from './billeder.ts';
import '../styles/valg-liste.css';
import { aabnFoto, tegnKvadrat, type Foto } from './tegnBillede.ts';
import './ProfilbilledeSheet.css';

/**
 * Where the sheet is.
 * - `valg`: your picture now, "Vælg billede" and "Fjern billede".
 * - `gemmer` / `fjerner`: busy.
 * #102 adds `{ trin: 'beskaer'; foto: Foto }` between picking and `gem`.
 */
type Trin = { trin: 'valg' } | { trin: 'gemmer' } | { trin: 'fjerner' };

/**
 * Your own Profilbillede in this box (opened from your avatar on your
 * profile). Picking a photo centre-crops it to a square, shrinks it to about
 * 512 px, uploads it and sets it. "Fjern billede" goes back to initials.
 */
export function ProfilbilledeSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { bodekasseId, bodekasseNavn, medlemId, navn } = useBodekasse();
  const { load } = useMedlemskaber();
  const { billede, opdater } = useBilleder();
  const [trin, setTrin] = useState<Trin>({ trin: 'valg' });
  const [fejl, setFejl] = useState<string | null>(null);
  // "Brug også i mine andre bødekasser": off each time the sheet opens.
  const [brugOgsaa, setBrugOgsaa] = useState(false);
  const filFelt = useRef<HTMLInputElement>(null);

  const url = billede(medlemId);
  const busy = trin.trin !== 'valg';
  // Your active Medlemmer (Udmeldt ones aren't loaded).
  const mine = load.status === 'ready' ? load.medlemskaber : [];
  const andre = andreKasser(mine, bodekasseId);

  function skift(aaben: boolean) {
    if (!aaben) {
      setFejl(null);
      setBrugOgsaa(false);
    }
    onOpenChange(aaben);
  }

  function faerdig() {
    opdater();
    setTrin({ trin: 'valg' });
    skift(false);
  }

  function fejlede(tekst: string) {
    setFejl(tekst);
    setTrin({ trin: 'valg' });
  }

  async function valgtFil(event: ChangeEvent<HTMLInputElement>) {
    const fil = event.target.files?.[0];
    // Cleared, so picking the same photo again still fires a change.
    event.target.value = '';
    if (!fil) return;
    setFejl(null);
    setTrin({ trin: 'gemmer' });
    let foto: Foto;
    try {
      foto = await aabnFoto(fil);
    } catch {
      fejlede(t('fejl.billedeAabn'));
      return;
    }
    // #102: go to `{ trin: 'beskaer', foto }` here; its Gem calls `gem` with the crop.
    await gem(foto, midterKvadrat(foto.bredde, foto.hoejde));
  }

  /** Draws, uploads and sets the chosen square of the photo. */
  async function gem(foto: Foto, kvadrat: Kvadrat) {
    setTrin({ trin: 'gemmer' });
    let tegnet;
    try {
      tegnet = await tegnKvadrat(foto, kvadrat);
    } catch {
      fejlede(t('fejl.billedeAabn'));
      return;
    } finally {
      foto.luk();
    }
    const { sti, error: uploadFejl } = await uploadBillede(bodekasseId, medlemId, tegnet.blob, tegnet.type);
    if (uploadFejl) {
      fejlede(t('fejl.billedeUpload'));
      return;
    }
    const { error } = await saetMitBillede(crypto.randomUUID(), bodekasseId, sti);
    if (error) {
      void sletUpload(sti);
      fejlede(rpcErrorText(error));
      return;
    }
    if (brugOgsaa && andre.length > 0) {
      const til = kopiStier(mine, bodekasseId, tegnet.type);
      const kopi = await kopierMitBillede(crypto.randomUUID(), bodekasseId, sti, til);
      if (kopi.error || kopi.mangler > 0) {
        // Saved here, but not everywhere: show the new picture and say so.
        opdater();
        fejlede(t('fejl.billedeKopi'));
        return;
      }
    }
    faerdig();
  }

  async function fjern() {
    setFejl(null);
    setTrin({ trin: 'fjerner' });
    const { error } = await fjernMitBillede(crypto.randomUUID(), bodekasseId);
    if (error) {
      fejlede(rpcErrorText(error));
      return;
    }
    faerdig();
  }

  return (
    <Sheet
      open={open}
      onOpenChange={skift}
      height="partial"
      title={t('profilbillede.titel')}
      footer={
        <>
          <SheetAction disabled={busy} error={fejl} onClick={() => filFelt.current?.click()}>
            {t(trin.trin === 'gemmer' ? 'profilbillede.gemmer' : 'profilbillede.vaelg')}
          </SheetAction>
          {url && (
            <button
              type="button"
              className="profilbillede__fjern"
              disabled={busy}
              onClick={() => void fjern()}
            >
              {t(trin.trin === 'fjerner' ? 'profilbillede.fjerner' : 'profilbillede.fjern')}
            </button>
          )}
        </>
      }
    >
      <div className="profilbillede__forhaand">
        <Avatar navn={navn} size={120} egen billede={url} />
      </div>
      <p className="profilbillede__note">{t('profilbillede.note', { bodekasse: bodekasseNavn })}</p>
      {andre.length > 0 && (
        <div className="valg-liste profilbillede__andre">
          <button
            type="button"
            role="checkbox"
            aria-checked={brugOgsaa}
            disabled={busy}
            className={`valg-liste__raekke${brugOgsaa ? ' valg-liste__raekke--valgt' : ''}`}
            onClick={() => setBrugOgsaa(!brugOgsaa)}
          >
            <span className="valg-liste__radio profilbillede__boks" aria-hidden="true" />
            <span className="valg-liste__tekst">
              <span className="valg-liste__navn">{t('profilbillede.brugOgsaa')}</span>
              <span className="valg-liste__under">{andre.map((m) => m.bodekasseNavn).join(', ')}</span>
            </span>
          </button>
        </div>
      )}
      {/* No `capture`: iOS and Android then offer both the library and the camera. */}
      <input
        ref={filFelt}
        type="file"
        accept="image/*"
        hidden
        tabIndex={-1}
        onChange={(e) => void valgtFil(e)}
      />
    </Sheet>
  );
}
