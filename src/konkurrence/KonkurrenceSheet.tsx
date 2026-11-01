import { useMemo, useState, type FormEvent } from 'react';
import { useBilleder } from '../billeder/BilledProvider.tsx';
import { useBodekasse } from '../bodekasse/BodekasseProvider.tsx';
import { Avatar } from '../components/Avatar.tsx';
import { Field } from '../components/Field.tsx';
import { primaryAction } from '../components/field.ts';
import { Sheet } from '../components/Sheet.tsx';
import { SheetAction } from '../components/SheetAction.tsx';
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
  const { billede } = useBilleder();
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

  const handling = primaryAction(
    [
      [titel.trim() !== '', t('fejl.titelMangler')],
      [dato !== '', t('aarsag.vaelgDato')],
      [r.ids.length > 0, t('aarsag.placerDeltager')],
      // While the rules load (or failed, which shows in the form), there is nothing more to say.
      [regler !== undefined, ''],
    ],
    { busy },
  );
  const kanGemme = handling.enabled;

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
      dirty={titel !== (konkurrence?.titel ?? '')}
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
          <SheetAction form={FORM_ID} disabled={!kanGemme} reason={handling.reason} error={fejl}>
            {t(konkurrence ? 'konkurrence.gemRettelse' : 'konkurrence.gem')}
          </SheetAction>
        </div>
      }
    >
      <form id={FORM_ID} className="kny" onSubmit={(e) => void gem(e)}>
        <div className="kny__felter">
          <Field
            variant="row"
            label={t('konkurrence.titel')}
            value={titel}
            onChange={setTitel}
            placeholder={t('konkurrence.titelPladsholder')}
            maxLength={60}
          />
          <Field variant="row" kind="date" label={t('konkurrence.dato')} value={dato} onChange={setDato} required />
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
                    <Avatar navn={d.navn} size={36} egen={d.medlemId === medlemId} stiplet={!d.loggetInd} billede={billede(d.medlemId)} />
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
                  <Avatar navn={d.navn} size={36} egen={d.medlemId === medlemId} stiplet={!d.loggetInd} billede={billede(d.medlemId)} />
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
      </form>
    </Sheet>
  );
}
