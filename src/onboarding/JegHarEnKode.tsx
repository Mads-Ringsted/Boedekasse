import { useRef, useState, type FormEvent } from 'react';
import { Check } from 'lucide-react';
import { useMedlemskaber } from '../bodekasse/BodekasseProvider.tsx';
import { BackButton } from '../components/BackButton.tsx';
import { forbogstav } from '../components/initialer.ts';
import { JOIN_KODE_LAENGDE, rensJoinKode } from '../medlemmer/joinKode.ts';
import { t } from '../strings/index.ts';
import { supabase } from '../supabase/index.ts';
import { rpcErrorText } from '../supabase/rpcErrors.ts';
import './Onboarding.css';
import './JegHarEnKode.css';

interface JegHarEnKodeProps {
  onBack: () => void;
  /** You are a Medlem of the box now; open it. */
  onJoined: (bodekasseId: string) => Promise<void>;
}

interface FundetKasse {
  bodekasse_id: string;
  navn: string;
  antal_medlemmer: number;
  allerede_medlem: boolean;
}

type Opslag =
  | { status: 'tom' }
  | { status: 'soeger' }
  | { status: 'fundet'; kasse: FundetKasse }
  | { status: 'fejl'; fejl: string };

/** Six code boxes; the box found; your name; then that box's Hjem. */
export function JegHarEnKode({ onBack, onJoined }: JegHarEnKodeProps) {
  const { load } = useMedlemskaber();
  const [kode, setKode] = useState('');
  const [fokus, setFokus] = useState(false);
  const [opslag, setOpslag] = useState<Opslag>({ status: 'tom' });
  // Your name in another box is a good first guess; names are still per box.
  const [navn, setNavn] = useState(() => (load.status === 'ready' ? (load.medlemskaber[0]?.navn ?? '') : ''));
  const [busy, setBusy] = useState(false);
  const [fejl, setFejl] = useState<string | null>(null);
  const [klientId] = useState(() => crypto.randomUUID());
  const sidsteKode = useRef('');

  async function skrivKode(input: string) {
    const ny = rensJoinKode(input);
    setKode(ny);
    setFejl(null);
    if (ny === sidsteKode.current) return;
    sidsteKode.current = ny;
    if (ny.length < JOIN_KODE_LAENGDE) {
      setOpslag({ status: 'tom' });
      return;
    }
    setOpslag({ status: 'soeger' });
    const { data, error } = await supabase.rpc('find_bodekasse_med_kode', { p_kode: ny });
    if (sidsteKode.current !== ny) return; // a newer code was typed meanwhile
    setOpslag(error ? { status: 'fejl', fejl: rpcErrorText(error) } : { status: 'fundet', kasse: data as unknown as FundetKasse });
  }

  const kasse = opslag.status === 'fundet' ? opslag.kasse : null;
  const kanTilmelde = kasse !== null && (kasse.allerede_medlem || navn.trim() !== '') && !busy;

  async function tilmeld(event: FormEvent) {
    event.preventDefault();
    if (!kasse || !kanTilmelde) return;
    setBusy(true);
    setFejl(null);
    const { data, error } = await supabase.rpc('tilmeld_med_kode', {
      p_klient_id: klientId,
      p_kode: kode,
      p_mit_navn: navn,
    });
    if (error) {
      setFejl(rpcErrorText(error));
      setBusy(false);
      return;
    }
    await onJoined((data as { bodekasse_id: string }).bodekasse_id);
  }

  return (
    <form className="onboarding" onSubmit={(e) => void tilmeld(e)}>
      <BackButton label={t('sheet.tilbage')} onClick={onBack} />
      <h1 className="onboarding__title">{t('kode.titel')}</h1>

      <label className="kode-felt">
        <input
          className="kode-felt__input"
          type="text"
          value={kode}
          onChange={(e) => void skrivKode(e.target.value)}
          onFocus={() => setFokus(true)}
          onBlur={() => setFokus(false)}
          aria-label={t('kode.label')}
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="next"
          autoFocus
        />
        {Array.from({ length: JOIN_KODE_LAENGDE }, (_, i) => (
          <span
            key={i}
            className={`kode-felt__boks${fokus && i === Math.min(kode.length, JOIN_KODE_LAENGDE - 1) ? ' kode-felt__boks--aktiv' : ''}`}
            aria-hidden="true"
          >
            {kode[i] ?? ''}
          </span>
        ))}
      </label>

      {opslag.status === 'fejl' && (
        <p className="onboarding__error" role="alert">
          {opslag.fejl}
        </p>
      )}

      {kasse && (
        <div className="fundet-kasse">
          <span className="fundet-kasse__tile" aria-hidden="true">
            {forbogstav(kasse.navn)}
          </span>
          <span className="fundet-kasse__tekst">
            <span className="fundet-kasse__navn">{kasse.navn}</span>
            <span className="fundet-kasse__antal">
              {kasse.antal_medlemmer === 1
                ? t('vaelg.etMedlem')
                : t('vaelg.antalMedlemmer', { antal: kasse.antal_medlemmer })}
            </span>
          </span>
          <span className="fundet-kasse__check" aria-hidden="true">
            <Check size={14} strokeWidth={3} />
          </span>
        </div>
      )}

      {kasse && kasse.allerede_medlem && <p className="onboarding__note">{t('kode.alleredeMedlem')}</p>}

      {kasse && !kasse.allerede_medlem && (
        <label className="onboarding__field">
          <span className="onboarding__label">{t('kode.navn')}</span>
          <input
            className="onboarding__input"
            type="text"
            value={navn}
            onChange={(e) => setNavn(e.target.value)}
            autoComplete="name"
            enterKeyHint="done"
          />
        </label>
      )}

      {fejl && (
        <p className="onboarding__error" role="alert">
          {fejl}
        </p>
      )}

      <button type="submit" className="onboarding__primary" disabled={!kanTilmelde}>
        {kasse?.allerede_medlem ? t('kode.aaben') : t('kode.knap')}
      </button>
    </form>
  );
}
