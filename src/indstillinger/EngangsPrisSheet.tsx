import { useState, type FormEvent } from 'react';
import { Sheet } from '../components/Sheet.tsx';
import { t } from '../strings/index.ts';
import { rpcErrorText } from '../supabase/rpcErrors.ts';
import { tjekEngangsPris, type EngangsPrisMode, type IndstillingAendringer } from './indstillinger.ts';
import '../frikob/Frikob.css';
import '../medlemmer/felter.css';
import './Indstillinger.css';

const MODES: readonly EngangsPrisMode[] = ['fri', 'fast', 'loft'];
const FORM_ID = 'engangs-pris';

interface EngangsPrisSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: EngangsPrisMode;
  pris: number | null;
  /** Saves; throws the RPC error. Gets one one-time ID per opening. */
  onGem: (aendringer: IndstillingAendringer, klientId: string) => Promise<void>;
}

/**
 * The Engangsbøde price (#76): Fri, Fast or Loft, and the amount for Fast and
 * Loft. Mount it with a new `key` per opening.
 */
export function EngangsPrisSheet({ open, onOpenChange, mode: startMode, pris, onGem }: EngangsPrisSheetProps) {
  const start = pris === null ? '' : String(pris);
  const [mode, setMode] = useState(startMode);
  const [tekst, setTekst] = useState(start);
  const [busy, setBusy] = useState(false);
  const [fejl, setFejl] = useState<string | null>(null);
  const [klientId] = useState(() => crypto.randomUUID());

  const resultat = tjekEngangsPris(mode, tekst);
  const aendret = mode !== startMode || (mode !== 'fri' && tekst !== start);
  const kanGemme = resultat.ok && aendret && !busy;

  async function gem(event: FormEvent) {
    event.preventDefault();
    if (!kanGemme || !resultat.ok) return;
    setBusy(true);
    setFejl(null);
    try {
      await onGem(resultat.aendringer, klientId);
      onOpenChange(false);
    } catch (error) {
      setFejl(rpcErrorText(error));
    } finally {
      setBusy(false);
    }
  }

  // Only complain once something has been typed.
  const hint =
    !resultat.ok && resultat.fejl === 'ugyldig' && tekst.trim() !== '' ? t('indstillinger.beloebUgyldig') : null;

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      height="partial"
      title={t('indstillinger.engangsPrisTitel')}
      dirty={aendret}
      footer={
        <button type="submit" form={FORM_ID} className="felt-knap" disabled={!kanGemme}>
          {t('indstillinger.gem')}
        </button>
      }
    >
      <form id={FORM_ID} onSubmit={(e) => void gem(e)}>
        <div role="radiogroup" aria-label={t('indstillinger.engangsPrisTitel')} className="frikob-valg">
          {MODES.map((m) => {
            const valgt = m === mode;
            return (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={valgt}
                className={`frikob-valg__raekke${valgt ? ' frikob-valg__raekke--valgt' : ''}`}
                onClick={() => setMode(m)}
              >
                <span className="frikob-valg__radio" aria-hidden="true" />
                <span className="frikob-valg__tekst">
                  <span className="frikob-valg__navn">{t(`indstillinger.engangsMode.${m}` as const)}</span>
                  <span className="frikob-valg__under">{t(`indstillinger.engangsModeUnder.${m}` as const)}</span>
                </span>
              </button>
            );
          })}
        </div>

        {mode !== 'fri' && (
          <label className="felt">
            <span className="felt__label">{t(`indstillinger.engangsBeloeb.${mode}` as const)}</span>
            <span className="indst-felt">
              <input
                className="felt__input indst-felt__input"
                type="text"
                inputMode="numeric"
                value={tekst}
                onChange={(e) => setTekst(e.target.value)}
                autoComplete="off"
                enterKeyHint="done"
              />
              <span className="indst-felt__enhed">{t('kategori.kr')}</span>
            </span>
          </label>
        )}
        {hint && <p className="felt-fejl">{hint}</p>}
        {mode !== 'fri' && !resultat.ok && resultat.fejl === 'mangler' && aendret && (
          <p className="felt-note">{t('indstillinger.engangsPrisMangler')}</p>
        )}
        <p className="felt-note">{t('indstillinger.engangsPrisNote')}</p>
        {fejl && (
          <p className="felt-fejl" role="alert">
            {fejl}
          </p>
        )}
      </form>
    </Sheet>
  );
}
