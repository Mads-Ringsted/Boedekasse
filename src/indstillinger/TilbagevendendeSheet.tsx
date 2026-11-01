import { useRef, useState, type FormEvent } from 'react';
import { useBodekasse } from '../bodekasse/BodekasseProvider.tsx';
import { Sheet } from '../components/Sheet.tsx';
import { kortDato } from '../kategorier/kategoriListe.ts';
import { t } from '../strings/index.ts';
import { rpcErrorText } from '../supabase/rpcErrors.ts';
import { gemTilbagevendende, stopTilbagevendende, type TilbagevendendeMedlem } from './hentTilbagevendende.ts';
import {
  naesteForekomst,
  tjekTilbagevendende,
  ugedagNavn,
  type Frekvens,
  type TilbagevendendeGebyr,
} from './tilbagevendende.ts';
import '../frikob/Frikob.css';
import '../medlemmer/felter.css';
import './Indstillinger.css';

const FORM_ID = 'tilbagevendende-form';
const FREKVENSER: readonly Frekvens[] = ['uge', 'maaned'];
const UGEDAGE = [1, 2, 3, 4, 5, 6, 7];
const MAANEDSDAGE = Array.from({ length: 28 }, (_, i) => i + 1);

interface TilbagevendendeSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Ret this one; without it, Nyt gebyr. */
  tilbagevendende?: TilbagevendendeGebyr;
  /** Every Medlem of the box, by name. */
  medlemmer: readonly TilbagevendendeMedlem[];
  /** Saved or stopped. */
  onGemt: () => void;
}

/**
 * Nyt / Ret Tilbagevendende Gebyr (#79): name, amount, weekly or monthly
 * frequency and the Medlemmer it hits; Ret also offers Stop. Mount it with a
 * new `key` per opening so the fields and the one-time IDs start fresh.
 */
export function TilbagevendendeSheet({
  open,
  onOpenChange,
  tilbagevendende,
  medlemmer,
  onGemt,
}: TilbagevendendeSheetProps) {
  const { bodekasseId } = useBodekasse();
  const [navn, setNavn] = useState(tilbagevendende?.navn ?? '');
  const [beloeb, setBeloeb] = useState(tilbagevendende ? String(tilbagevendende.beloeb) : '');
  const [frekvens, setFrekvens] = useState<Frekvens>(tilbagevendende?.frekvens ?? 'uge');
  const [dag, setDag] = useState(tilbagevendende?.dag ?? 1);
  const [valgte, setValgte] = useState<ReadonlySet<string>>(() => new Set(tilbagevendende?.medlemmer ?? []));
  const [busy, setBusy] = useState(false);
  const [fejl, setFejl] = useState<string | null>(null);
  const [bekraefterStop, setBekraefterStop] = useState(false);
  const [klientId] = useState(() => crypto.randomUUID());
  const [stopId] = useState(() => crypto.randomUUID());
  const navnFelt = useRef<HTMLInputElement>(null);
  // Typed text only: the frequency and Medlemmer are quick to pick again.
  const aendret =
    navn !== (tilbagevendende?.navn ?? '') || beloeb !== (tilbagevendende ? String(tilbagevendende.beloeb) : '');

  // Active Medlemmer, plus Udmeldte it already lists (so they can be taken off).
  const viste = medlemmer.filter((m) => !m.udmeldt || valgte.has(m.id));
  const alleValgt = viste.length > 0 && viste.every((m) => valgte.has(m.id));
  const resultat = tjekTilbagevendende({ navn, beloeb, frekvens, dag, medlemmer: [...valgte] });
  const kanGemme = resultat.ok && !busy;

  function skiftFrekvens(ny: Frekvens) {
    setFrekvens(ny);
    if (ny === 'uge' && dag > 7) setDag(1);
  }

  function skiftMedlem(id: string) {
    setValgte((v) => {
      const ny = new Set(v);
      if (ny.has(id)) ny.delete(id);
      else ny.add(id);
      return ny;
    });
  }

  async function koer(handling: () => Promise<void>) {
    setBusy(true);
    setFejl(null);
    try {
      await handling();
      onGemt();
    } catch (error) {
      setFejl(rpcErrorText(error));
    } finally {
      setBusy(false);
    }
  }

  function gem(event: FormEvent) {
    event.preventDefault();
    if (!kanGemme || !resultat.ok) return;
    void koer(() => gemTilbagevendende(klientId, bodekasseId, tilbagevendende?.id ?? null, resultat.vaerdi));
  }

  function stop() {
    if (!tilbagevendende) return;
    if (!bekraefterStop) {
      setBekraefterStop(true);
      return;
    }
    void koer(() => stopTilbagevendende(stopId, tilbagevendende.id));
  }

  const beloebHint = beloeb.trim() !== '' && !resultat.ok && resultat.fejl === 'beloeb';

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      height="full"
      title={t(tilbagevendende ? 'tilbagevendende.retTitel' : 'tilbagevendende.nyTitel')}
      initialFocus={tilbagevendende ? undefined : navnFelt}
      dirty={aendret}
      footer={
        <button type="submit" form={FORM_ID} className="felt-knap" disabled={!kanGemme}>
          {t(tilbagevendende ? 'tilbagevendende.gem' : 'tilbagevendende.opret')}
        </button>
      }
    >
      <form id={FORM_ID} onSubmit={gem}>
        <label className="felt">
          <span className="felt__label">{t('tilbagevendende.navn')}</span>
          <input
            ref={navnFelt}
            className="felt__input"
            type="text"
            value={navn}
            onChange={(e) => setNavn(e.target.value)}
            placeholder={t('tilbagevendende.navnPladsholder')}
            autoComplete="off"
            maxLength={60}
          />
        </label>

        <label className="felt">
          <span className="felt__label">{t('tilbagevendende.beloeb')}</span>
          <span className="indst-felt">
            <input
              className="felt__input indst-felt__input"
              type="text"
              inputMode="numeric"
              value={beloeb}
              onChange={(e) => setBeloeb(e.target.value)}
              autoComplete="off"
            />
            <span className="indst-felt__enhed">{t('kategori.kr')}</span>
          </span>
        </label>
        {beloebHint && <p className="felt-fejl">{t('tilbagevendende.beloebUgyldig')}</p>}

        <div className="felt">
          <span className="felt__label">{t('tilbagevendende.hvorOfte')}</span>
          <div role="radiogroup" aria-label={t('tilbagevendende.hvorOfte')} className="frikob-valg">
            {FREKVENSER.map((f) => {
              const valgt = f === frekvens;
              return (
                <button
                  key={f}
                  type="button"
                  role="radio"
                  aria-checked={valgt}
                  className={`frikob-valg__raekke${valgt ? ' frikob-valg__raekke--valgt' : ''}`}
                  onClick={() => skiftFrekvens(f)}
                >
                  <span className="frikob-valg__radio" aria-hidden="true" />
                  <span className="frikob-valg__tekst">
                    <span className="frikob-valg__navn">
                      {t(f === 'uge' ? 'tilbagevendende.ugentlig' : 'tilbagevendende.maanedlig')}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <label className="felt">
          <span className="felt__label">
            {t(frekvens === 'uge' ? 'tilbagevendende.ugedag' : 'tilbagevendende.dagIMaaneden')}
          </span>
          <select className="felt__input" value={dag} onChange={(e) => setDag(Number(e.target.value))}>
            {(frekvens === 'uge' ? UGEDAGE : MAANEDSDAGE).map((d) => (
              <option key={d} value={d}>
                {frekvens === 'uge' ? ugedagNavn(d) : `${d}.`}
              </option>
            ))}
          </select>
        </label>

        <div className="felt">
          <span className="felt__label tilb__overskrift">
            {t('tilbagevendende.medlemmer')}
            <button
              type="button"
              className="tilb__alle"
              onClick={() => setValgte(alleValgt ? new Set() : new Set(viste.map((m) => m.id)))}
            >
              {t(alleValgt ? 'tilbagevendende.fravaelgAlle' : 'tilbagevendende.vaelgAlle')}
            </button>
          </span>
          <div className="frikob-valg">
            {viste.map((m) => {
              const valgt = valgte.has(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  role="checkbox"
                  aria-checked={valgt}
                  className={`frikob-valg__raekke${valgt ? ' frikob-valg__raekke--valgt' : ''}`}
                  onClick={() => skiftMedlem(m.id)}
                >
                  <span className="frikob-valg__radio tilb__boks" aria-hidden="true" />
                  <span className="frikob-valg__tekst">
                    <span className="frikob-valg__navn">{m.navn}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <p className="felt-note">
          {t('tilbagevendende.note', { naeste: kortDato(`${naesteForekomst(frekvens, dag)}T12:00:00Z`) })}
        </p>
        {fejl && (
          <p className="felt-fejl" role="alert">
            {fejl}
          </p>
        )}

        {tilbagevendende && (
          <>
            <button type="button" className="tilb__stop" onClick={stop} disabled={busy}>
              {t(bekraefterStop ? 'tilbagevendende.stopBekraeft' : 'tilbagevendende.stop')}
            </button>
            <p className="felt-note">{t('tilbagevendende.stopNote')}</p>
          </>
        )}
      </form>
    </Sheet>
  );
}
