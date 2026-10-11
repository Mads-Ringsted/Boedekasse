import { useState, type FormEvent } from 'react';
import { useBodekasse, useMedlemskaber } from '../bodekasse/BodekasseProvider.tsx';
import { Sheet } from '../components/Sheet.tsx';
import { t } from '../strings/index.ts';
import { supabase } from '../supabase/index.ts';
import { rpcErrorText } from '../supabase/rpcErrors.ts';
import './felter.css';

/** Your own name in this box. Names are per box. */
export function RetMitNavnSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { bodekasseId, bodekasseNavn, navn: nuvaerende } = useBodekasse();
  const { reload } = useMedlemskaber();
  const [navn, setNavn] = useState(nuvaerende);
  const [busy, setBusy] = useState(false);
  const [fejl, setFejl] = useState<string | null>(null);
  const [klientId, setKlientId] = useState(() => crypto.randomUUID());

  const kanGemme = navn.trim() !== '' && navn.trim() !== nuvaerende && !busy;

  function skift(aaben: boolean) {
    setNavn(nuvaerende);
    setFejl(null);
    setKlientId(crypto.randomUUID());
    onOpenChange(aaben);
  }

  async function gem(event: FormEvent) {
    event.preventDefault();
    if (!kanGemme) return;
    setBusy(true);
    setFejl(null);
    const { error } = await supabase.rpc('ret_mit_navn', {
      p_klient_id: klientId,
      p_bodekasse: bodekasseId,
      p_navn: navn,
    });
    if (error) {
      setBusy(false);
      setFejl(rpcErrorText(error));
      return;
    }
    // The name lives on your Medlemskab, so every screen shows the new one.
    await reload();
    setBusy(false);
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={skift} height="partial" title={t('mitNavn.titel')}>
      <form onSubmit={(e) => void gem(e)}>
        <label className="felt">
          <span className="felt__label">{t('mitNavn.label', { bodekasse: bodekasseNavn })}</span>
          <input
            className="felt__input"
            type="text"
            value={navn}
            onChange={(e) => setNavn(e.target.value)}
            autoComplete="name"
            enterKeyHint="done"
          />
        </label>
        <p className="felt-note">{t('mitNavn.note')}</p>
        {fejl && (
          <p className="felt-fejl" role="alert">
            {fejl}
          </p>
        )}
        <button type="submit" className="felt-knap felt-knap--naer" disabled={!kanGemme}>
          {t('mitNavn.gem')}
        </button>
      </form>
    </Sheet>
  );
}
