import { useState, type FormEvent } from 'react';
import { TriangleAlert } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useBodekasse, useMedlemskaber } from '../bodekasse/BodekasseProvider.tsx';
import { Sheet } from '../components/Sheet.tsx';
import { t } from '../strings/index.ts';
import { rpcErrorText } from '../supabase/rpcErrors.ts';
import { useHent } from '../supabase/useHent.ts';
import { hentAntalMedlemmer, sletBodekasse } from './hentSlet.ts';
import { navnPasser } from './slet.ts';
import './Slet.css';

interface SletBodekasseSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** "Eksportér data først": closes this sheet and starts the export. */
  onEksporter: () => void;
}

/**
 * Slet Bødekasse (Admin, slet-boedekasse.html): a red warning, who loses
 * what, "Eksportér data først", type the box name, then a red "Slet for alle".
 * Afterwards the app shows your other box, Vælg Bødekasse or Velkommen.
 * Mount with a fresh `key` per opening, so the one-time ID is new.
 */
export function SletBodekasseSheet({ open, onOpenChange, onEksporter }: SletBodekasseSheetProps) {
  const { bodekasseId, bodekasseNavn } = useBodekasse();
  const { reload } = useMedlemskaber();
  const navigate = useNavigate();
  const antal = useHent(() => hentAntalMedlemmer(bodekasseId), [bodekasseId]);
  const [klientId] = useState(() => crypto.randomUUID());
  const [skrevet, setSkrevet] = useState('');
  const [busy, setBusy] = useState(false);
  const [fejl, setFejl] = useState<string | null>(null);
  const kanSlette = navnPasser(skrevet, bodekasseNavn) && !busy;

  async function slet(event?: FormEvent) {
    event?.preventDefault();
    if (!kanSlette) return;
    setBusy(true);
    setFejl(null);
    try {
      await sletBodekasse(klientId, bodekasseId, skrevet);
    } catch (e) {
      setBusy(false);
      setFejl(rpcErrorText(e));
      return;
    }
    // The box is gone: leave its screens, then let the box list pick where to go.
    await navigate('/', { replace: true });
    await reload();
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      height="full"
      title={t('sletKasse.titel')}
      footer={
        <button
          type="submit"
          form="slet-kasse"
          className="slet__knap"
          disabled={!kanSlette}
        >
          {t('sletKasse.knap')}
        </button>
      }
    >
      <div className="slet__advarsel">
        <span className="slet__ikon" aria-hidden="true">
          <TriangleAlert size={30} strokeWidth={2} />
        </span>
        <span className="slet__spoergsmaal">{t('sletKasse.spoergsmaal', { navn: bodekasseNavn })}</span>
        <span className="slet__tekst">
          {antal.status === 'ready'
            ? t('sletKasse.tekst', { antal: String(antal.data) })
            : t('sletKasse.tekstUdenAntal')}
        </span>
        <button type="button" className="slet__link" onClick={onEksporter}>
          {t('sletKasse.eksporter')}
        </button>
      </div>

      <form id="slet-kasse" onSubmit={(e) => void slet(e)}>
        <label className="slet__felt">
          <span className="slet__label">{t('sletKasse.skriv', { navn: bodekasseNavn })}</span>
          <input
            className="slet__input"
            type="text"
            value={skrevet}
            onChange={(e) => setSkrevet(e.target.value)}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="done"
          />
        </label>
      </form>
      {fejl && (
        <p className="slet__fejl" role="alert">
          {fejl}
        </p>
      )}
    </Sheet>
  );
}
