import { useState, type FormEvent } from 'react';
import { useBodekasse } from '../bodekasse/BodekasseProvider.tsx';
import { Sheet } from '../components/Sheet.tsx';
import { t } from '../strings/index.ts';
import { supabase } from '../supabase/index.ts';
import { rpcErrorText } from '../supabase/rpcErrors.ts';
import type { Kategori } from './hentKategorier.ts';
import { parsePris } from './kategoriListe.ts';

interface KategoriFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Redigér this one; without it, Ny bødekategori. */
  kategori?: Kategori;
  /** Saved; the id of the new or edited Bødekategori. */
  onSaved: (id: string) => void;
}

const FORM_ID = 'kategori-form';

/**
 * Ny bødekategori / Redigér: Navn, Pris (whole kroner) and an optional
 * Beskrivelse. Mount it with a new `key` per opening so the fields and the
 * one-time ID start fresh.
 */
export function KategoriFormSheet({ open, onOpenChange, kategori, onSaved }: KategoriFormSheetProps) {
  const { bodekasseId } = useBodekasse();
  const [navn, setNavn] = useState(kategori?.navn ?? '');
  const [pris, setPris] = useState(kategori ? String(kategori.pris) : '');
  const [beskrivelse, setBeskrivelse] = useState(kategori?.beskrivelse ?? '');
  const [busy, setBusy] = useState(false);
  const [fejl, setFejl] = useState<string | null>(null);
  // One ID per opening, so "Prøv igen" after a lost answer never saves twice.
  const [klientId] = useState(() => crypto.randomUUID());

  const prisTal = parsePris(pris);
  const kanGemme = navn.trim() !== '' && prisTal !== null && !busy;

  async function gem(event: FormEvent) {
    event.preventDefault();
    if (!kanGemme) return;
    setBusy(true);
    setFejl(null);
    const svar = kategori
      ? await supabase.rpc('ret_bodekategori', {
          p_klient_id: klientId,
          p_bodekategori: kategori.id,
          p_navn: navn,
          p_pris: prisTal,
          p_beskrivelse: beskrivelse,
        })
      : await supabase.rpc('opret_bodekategori', {
          p_klient_id: klientId,
          p_bodekasse: bodekasseId,
          p_navn: navn,
          p_pris: prisTal,
          p_beskrivelse: beskrivelse,
        });
    setBusy(false);
    if (svar.error) {
      setFejl(rpcErrorText(svar.error));
      return;
    }
    onSaved(kategori ? kategori.id : (svar.data as { bodekategori_id: string }).bodekategori_id);
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      height="full"
      title={t(kategori ? 'kategori.redigerTitel' : 'kategorier.ny')}
      footer={
        <button type="submit" form={FORM_ID} className="kategori-form__primary" disabled={!kanGemme}>
          {t(kategori ? 'kategori.gem' : 'kategori.opret')}
        </button>
      }
    >
      <form id={FORM_ID} className="kategori-form" onSubmit={(e) => void gem(e)}>
        <label className="kategori-form__field">
          <span className="kategori-form__label">{t('kategori.navn')}</span>
          <span className="kategori-form__boks">
            <input
              className="kategori-form__input"
              type="text"
              value={navn}
              onChange={(e) => setNavn(e.target.value)}
              autoComplete="off"
              enterKeyHint="next"
              maxLength={60}
              autoFocus={!kategori}
            />
          </span>
        </label>

        <label className="kategori-form__field">
          <span className="kategori-form__label">{t('kategori.pris')}</span>
          <span className="kategori-form__boks">
            <input
              className="kategori-form__input kategori-form__input--pris"
              type="text"
              inputMode="numeric"
              value={pris}
              onChange={(e) => setPris(e.target.value)}
              autoComplete="off"
              enterKeyHint="next"
            />
            <span className="kategori-form__enhed">{t('kategori.kr')}</span>
          </span>
          {pris.trim() !== '' && prisTal === null && (
            <span className="kategori-form__hint">{t('kategori.prisUgyldig')}</span>
          )}
        </label>

        <label className="kategori-form__field">
          <span className="kategori-form__label">{t('kategori.beskrivelse')}</span>
          <span className="kategori-form__boks kategori-form__boks--tekst">
            <textarea
              className="kategori-form__input kategori-form__textarea"
              value={beskrivelse}
              onChange={(e) => setBeskrivelse(e.target.value)}
              placeholder={t('kategori.beskrivelsePladsholder')}
              maxLength={300}
              rows={3}
            />
          </span>
        </label>

        {kategori && <p className="kategori-form__note">{t('kategori.redigerNote')}</p>}
        {fejl && (
          <p className="kategori-form__fejl" role="alert">
            {fejl}
          </p>
        )}
      </form>
    </Sheet>
  );
}
