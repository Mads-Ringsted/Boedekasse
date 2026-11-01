import { useRef, useState, type FormEvent } from 'react';
import { useBodekasse } from '../bodekasse/BodekasseProvider.tsx';
import { Field } from '../components/Field.tsx';
import { primaryAction, visibleError } from '../components/field.ts';
import { Sheet } from '../components/Sheet.tsx';
import { SheetAction } from '../components/SheetAction.tsx';
import { kortDato, parsePris } from '../kategorier/kategoriListe.ts';
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

/** Why Opret/Gem is off, for the form's first problem. */
function aarsag(fejl: 'navn' | 'beloeb' | 'dag' | 'medlemmer', beloeb: string): string {
  if (fejl === 'navn') return t('aarsag.skrivNavn');
  if (fejl === 'beloeb') return t(beloeb.trim() === '' ? 'aarsag.skrivBeloeb' : 'aarsag.retBeloeb');
  if (fejl === 'dag') return t('aarsag.vaelgDag');
  return t('aarsag.vaelgMedlemmer');
}
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
  const handling = primaryAction(
    [[resultat.ok, resultat.ok ? '' : aarsag(resultat.fejl, beloeb)]],
    { busy },
  );
  const kanGemme = handling.enabled;

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

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      height="full"
      title={t(tilbagevendende ? 'tilbagevendende.retTitel' : 'tilbagevendende.nyTitel')}
      initialFocus={tilbagevendende ? undefined : navnFelt}
      dirty={aendret}
      footer={
        <SheetAction form={FORM_ID} disabled={!kanGemme} reason={handling.reason} error={fejl}>
          {t(tilbagevendende ? 'tilbagevendende.gem' : 'tilbagevendende.opret')}
        </SheetAction>
      }
    >
      <form id={FORM_ID} onSubmit={gem}>
        <Field
          ref={navnFelt}
          label={t('tilbagevendende.navn')}
          value={navn}
          onChange={setNavn}
          placeholder={t('tilbagevendende.navnPladsholder')}
          maxLength={60}
          enterKeyHint="next"
        />

        <Field
          label={t('tilbagevendende.beloeb')}
          kind="integer"
          unit={t('kategori.kr')}
          value={beloeb}
          onChange={setBeloeb}
          error={visibleError(beloeb, parsePris(beloeb) === null ? t('tilbagevendende.beloebUgyldig') : null)}
        />

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
