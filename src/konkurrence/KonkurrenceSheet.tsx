import { useMemo, useState, type FormEvent } from 'react';
import { useBodekasse } from '../bodekasse/BodekasseProvider.tsx';
import { Avatar } from '../components/Avatar.tsx';
import { Sheet } from '../components/Sheet.tsx';
import { formatKr, t } from '../strings/index.ts';
import { rpcErrorText } from '../supabase/rpcErrors.ts';
import { useHent } from '../supabase/useHent.ts';
import { hentDeltagbare, hentRegler, registrerKonkurrence, retKonkurrence } from './hentKonkurrencer.ts';
import { iDagDato, type Konkurrence } from './konkurrence.ts';
import { erDelt, fraResultat, gebyrForPlads, opsummer, pladser, skiftDelt, tilGrupper, tryk, TOM } from './raekkefoelge.ts';
import '../medlemmer/felter.css';
import './Konkurrence.css';

interface KonkurrenceSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Ret konkurrence; without it, Ny konkurrence. */
  konkurrence?: Konkurrence;
  /** Saved; the Konkurrence's id. */
  onGemt: (id: string) => void;
}

const FORM_ID = 'konkurrence-form';
const dansk = new Intl.Collator('da', { sensitivity: 'base' });

/**
 * Ny konkurrence / Ret konkurrence (full sheet): Titel, Dato, then every
 * active Medlem. Tap them in finishing order; tap a placed number to share
 * the place with the one above. Untapped Medlemmer are Fraværende. Mount it
 * with a new `key` per opening so the fields and the one-time ID start fresh.
 */
export function KonkurrenceSheet({ open, onOpenChange, konkurrence, onGemt }: KonkurrenceSheetProps) {
  const { bodekasseId, medlemId } = useBodekasse();
  const hentet = useHent(
    () => Promise.all([hentRegler(bodekasseId), hentDeltagbare(bodekasseId)]),
    [bodekasseId],
  );
  const [titel, setTitel] = useState(konkurrence?.titel ?? '');
  const [dato, setDato] = useState(konkurrence?.dato ?? iDagDato());
  const [raekkefoelge, setRaekkefoelge] = useState(() =>
    konkurrence ? fraResultat(konkurrence.resultat) : TOM,
  );
  const [busy, setBusy] = useState(false);
  const [fejl, setFejl] = useState<string | null>(null);
  const [klientId] = useState(() => crypto.randomUUID());

  const klar = hentet.status === 'ready' ? hentet.data : null;
  const regler = klar?.[0];
  const deltagbare = useMemo(() => klar?.[1] ?? [], [klar]);
  // Only active Medlemmer can be placed (someone Udmeldt since drops out).
  const r = useMemo(() => {
    if (!klar) return raekkefoelge;
    const aktive = new Set(deltagbare.map((d) => d.medlemId));
    return { ids: raekkefoelge.ids.filter((id) => aktive.has(id)), delt: raekkefoelge.delt };
  }, [klar, deltagbare, raekkefoelge]);

  const pladsAf = new Map(pladser(r).map((p) => [p.medlemId, p.plads]));
  const efterId = new Map(deltagbare.map((d) => [d.medlemId, d]));
  const placeret = r.ids.flatMap((id) => efterId.get(id) ?? []);
  const fravaerende = deltagbare
    .filter((d) => !pladsAf.has(d.medlemId))
    .sort((a, b) => dansk.compare(a.navn, b.navn));
  const sum = regler
    ? opsummer(r, deltagbare.map((d) => d.medlemId), regler.placeringer, regler.fravaersgebyr)
    : null;

  const kanGemme = titel.trim() !== '' && dato !== '' && r.ids.length > 0 && regler !== undefined && !busy;

  async function gem(event: FormEvent) {
    event.preventDefault();
    if (!kanGemme) return;
    setBusy(true);
    setFejl(null);
    try {
      const grupper = tilGrupper(r);
      if (konkurrence) {
        await retKonkurrence({ klientId, konkurrenceId: konkurrence.id, titel, dato, grupper });
        onGemt(konkurrence.id);
      } else {
        onGemt(await registrerKonkurrence({ klientId, bodekasseId, titel, dato, grupper }));
      }
    } catch (error) {
      setFejl(rpcErrorText(error));
      setBusy(false);
    }
  }

  const navn = (d: { medlemId: string; navn: string }) => (d.medlemId === medlemId ? t('medlemmer.dig') : d.navn);

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      height="full"
      title={t(konkurrence ? 'konkurrence.ret' : 'konkurrencer.ny')}
      footer={
        <div className="kny__footer">
          {sum && (
            <div className="kny__sum">
              <span className="kny__sum-tekst">
                {t('konkurrence.footer', { placeret: sum.placeret, fravaerende: sum.fravaerende })}
              </span>
              <span className="kny__sum-beloeb">{formatKr(sum.total)}</span>
            </div>
          )}
          <button type="submit" form={FORM_ID} className="felt-knap" disabled={!kanGemme}>
            {t(konkurrence ? 'konkurrence.gemRettelse' : 'konkurrence.gem')}
          </button>
        </div>
      }
    >
      <form id={FORM_ID} className="kny" onSubmit={(e) => void gem(e)}>
        <div className="kny__felter">
          <label className="kny__felt">
            <span className="kny__label">{t('konkurrence.titel')}</span>
            <input
              className="kny__input"
              type="text"
              value={titel}
              onChange={(e) => setTitel(e.target.value)}
              placeholder={t('konkurrence.titelPladsholder')}
              autoComplete="off"
              enterKeyHint="done"
              maxLength={60}
            />
          </label>
          <label className="kny__felt">
            <span className="kny__label">{t('konkurrence.dato')}</span>
            <input
              className="kny__input kny__input--dato"
              type="date"
              value={dato}
              onChange={(e) => setDato(e.target.value)}
              required
            />
          </label>
        </div>

        <div className="kny__overskrift">
          <span>{t('konkurrence.trykIRaekkefoelge')}</span>
          {r.ids.length > 0 && (
            <button type="button" className="kny__nulstil" onClick={() => setRaekkefoelge(TOM)}>
              {t('konkurrence.nulstil')}
            </button>
          )}
        </div>

        {hentet.status === 'error' && (
          <button type="button" className="kny__fejl" onClick={hentet.reload}>
            {rpcErrorText(hentet.error)} · {t('handling.proevIgen')}
          </button>
        )}

        {klar && regler && (
          <ul className="kny__liste">
            {placeret.map((d, i) => {
              const plads = pladsAf.get(d.medlemId) ?? 0;
              const delt = erDelt(r, d.medlemId);
              return (
                <li key={d.medlemId} className="kny__raekke kny__raekke--placeret">
                  {i === 0 ? (
                    <span className="kny__nr">{plads}</span>
                  ) : (
                    <button
                      type="button"
                      className={`kny__nr${delt ? ' kny__nr--delt' : ''}`}
                      aria-label={`${plads}. ${t('konkurrence.delPlads')}`}
                      aria-pressed={delt}
                      onClick={() => setRaekkefoelge((x) => skiftDelt(x, d.medlemId))}
                    >
                      {plads}
                    </button>
                  )}
                  <button
                    type="button"
                    className="kny__person"
                    onClick={() => setRaekkefoelge((x) => tryk(x, d.medlemId))}
                  >
                    <Avatar navn={d.navn} size={36} egen={d.medlemId === medlemId} stiplet={!d.loggetInd} />
                    <span className="kny__navn">{navn(d)}</span>
                    <span className="kny__beloeb">{formatKr(gebyrForPlads(plads, regler.placeringer))}</span>
                  </button>
                </li>
              );
            })}
            {fravaerende.map((d) => (
              <li key={d.medlemId} className="kny__raekke">
                <span className="kny__nr kny__nr--tom" aria-hidden="true" />
                <button
                  type="button"
                  className="kny__person"
                  onClick={() => setRaekkefoelge((x) => tryk(x, d.medlemId))}
                >
                  <Avatar navn={d.navn} size={36} egen={d.medlemId === medlemId} stiplet={!d.loggetInd} />
                  <span className="kny__navn kny__navn--fravaer">{navn(d)}</span>
                  <span className="kny__fravaer">
                    {t('konkurrence.fravaerendeBeloeb', { beloeb: formatKr(regler.fravaersgebyr) })}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {r.ids.length > 1 && <p className="felt-note">{t('konkurrence.delHint')}</p>}
        {konkurrence && <p className="felt-note">{t('konkurrence.retNote')}</p>}
        {fejl && (
          <p className="felt-fejl" role="alert">
            {fejl}
          </p>
        )}
      </form>
    </Sheet>
  );
}
