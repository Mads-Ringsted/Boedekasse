import { useState, type FormEvent, type ReactNode } from 'react';
import { fornavn } from '../giv/navne.ts';
import { useLocation, useNavigate, useParams } from 'react-router';
import { TagMaerke } from '../aktivitet/TagMaerke.tsx';
import { useBodekasse } from '../bodekasse/BodekasseProvider.tsx';
import { Avatar } from '../components/Avatar.tsx';
import { BackButton } from '../components/BackButton.tsx';
import { Screen } from '../components/Screen.tsx';
import { Sheet } from '../components/Sheet.tsx';
import { kortNavne } from '../giv/navne.ts';
import { formatKr, t, type PlainStringId } from '../strings/index.ts';
import { rpcErrorText } from '../supabase/rpcErrors.ts';
import { useHent } from '../supabase/useHent.ts';
import { annullerKonkurrence, hentKonkurrence } from './hentKonkurrencer.ts';
import { handlinger, konkurrenceDato, type Deltager, type Konkurrence } from './konkurrence.ts';
import { KonkurrenceSheet } from './KonkurrenceSheet.tsx';
import '../medlemmer/felter.css';
import '../screens/hjem/Hjem.css';
import './Konkurrence.css';

/** Where the back button goes: the screen the result was opened from. */
const TILBAGE: Record<string, PlainStringId> = {
  '/': 'tab.hjem',
  '/aktivitet': 'tab.aktivitet',
  '/konkurrencer': 'mere.konkurrencer',
};

/**
 * A Konkurrence's result (/konkurrencer/:id): the top 3 on the Hjem podium,
 * the other places, then Fraværende. Its recorder or an Admin can correct it
 * (running Sæson) or annul it (latest Sæson).
 */
export function KonkurrenceDetalje() {
  const { id = '' } = useParams();
  const { bodekasseId, medlemId, erAdmin } = useBodekasse();
  const navigate = useNavigate();
  const fra = (useLocation().state as { fra?: string } | null)?.fra;
  const hentet = useHent(() => hentKonkurrence(bodekasseId, id), [bodekasseId, id]);
  const [retter, setRetter] = useState<{ n: number; open: boolean } | null>(null);
  const [annullerer, setAnnullerer] = useState<{ n: number; open: boolean } | null>(null);

  const data = hentet.status === 'ready' ? hentet.data : null;
  const k = data?.konkurrence ?? null;
  const kan = k && data ? handlinger(k, { medlemId, erAdmin }, data.regler) : { ret: false, annuller: false };

  const tilbage = () => (fra ? void navigate(-1) : void navigate('/konkurrencer'));

  return (
    <Screen>
      <BackButton label={t(fra ? (TILBAGE[fra] ?? 'sheet.tilbage') : 'mere.konkurrencer')} onClick={tilbage} />

      {hentet.status === 'error' && (
        <button type="button" className="konk__fejl" onClick={hentet.reload}>
          {rpcErrorText(hentet.error)} · {t('handling.proevIgen')}
        </button>
      )}
      {data && !k && <p className="konk__note">{t('konkurrence.findesIkke')}</p>}

      {k && (
        <Resultat k={k} medlemId={medlemId}>
          {(kan.ret || kan.annuller) && (
            <div className="konk-detalje__handlinger">
              {kan.ret && (
                <button
                  type="button"
                  className="konk-detalje__knap"
                  onClick={() => setRetter((s) => ({ n: (s?.n ?? 0) + 1, open: true }))}
                >
                  {t('konkurrence.ret')}
                </button>
              )}
              {kan.annuller && (
                <button
                  type="button"
                  className="konk-detalje__knap konk-detalje__knap--fare"
                  onClick={() => setAnnullerer((s) => ({ n: (s?.n ?? 0) + 1, open: true }))}
                >
                  {t('konkurrence.annuller')}
                </button>
              )}
            </div>
          )}
        </Resultat>
      )}

      {k && retter && (
        <KonkurrenceSheet
          key={retter.n}
          open={retter.open}
          onOpenChange={(open) => setRetter((s) => s && { ...s, open })}
          konkurrence={k}
          onGemt={() => {
            setRetter((s) => s && { ...s, open: false });
            hentet.reload();
          }}
        />
      )}
      {k && annullerer && (
        <AnnullerSheet
          key={annullerer.n}
          open={annullerer.open}
          onOpenChange={(open) => setAnnullerer((s) => s && { ...s, open })}
          k={k}
          onAnnulleret={() => {
            setAnnullerer((s) => s && { ...s, open: false });
            hentet.reload();
          }}
        />
      )}
    </Screen>
  );
}

function Resultat({ k, medlemId, children }: { k: Konkurrence; medlemId: string; children?: ReactNode }) {
  const kort = kortNavne(k.resultat.map((d) => d.navn));
  const korte = new Map(k.resultat.map((d, i) => [d.medlemId, kort[i]]));
  const navn = (d: Deltager) => (d.medlemId === medlemId ? t('medlemmer.dig') : (korte.get(d.medlemId) ?? d.navn));
  const placeret = k.resultat.filter((d) => d.plads !== null);
  const top = placeret.slice(0, 3).map((d, i) => ({ d, trin: i + 1 }));
  const podie = [top[1], top[0], top[2]].filter((x) => x !== undefined);
  const resten = placeret.slice(3);
  const fravaerende = k.resultat.filter((d) => d.plads === null);
  const annulleret = k.annullering !== null;

  const raekke = (d: Deltager) => (
    <li key={d.medlemId} className={`konk-detalje__raekke${d.medlemId === medlemId ? ' konk-detalje__raekke--egen' : ''}`}>
      <span className="konk-detalje__nr">{d.plads ?? ''}</span>
      <Avatar navn={d.navn} size={34} egen={d.medlemId === medlemId} stiplet={!d.loggetInd} />
      <span className={`konk-detalje__navn${d.plads === null ? ' konk-detalje__navn--fravaer' : ''}`}>{navn(d)}</span>
      <span className="konk-detalje__beloeb">{formatKr(d.beloeb)}</span>
    </li>
  );

  return (
    <div className={`konk-detalje${annulleret ? ' konk-detalje--annulleret' : ''}`}>
      <div className="konk-detalje__hoved">
        <span className="konk-detalje__titel-blok">
          <h1 className="screen__title konk-detalje__titel">{k.titel}</h1>
          <span className="konk-detalje__under">
            {t('konkurrence.registreretAf', { dato: konkurrenceDato(k.dato), navn: fornavn(k.oprettetAfNavn) })}
          </span>
          {(annulleret || k.rettetAfNavn) && (
            <span className="konk-detalje__tags">
              {annulleret ? (
                <TagMaerke tag={{ tekst: t('boede.tag.annulleret'), tone: 'graa' }} />
              ) : (
                <TagMaerke
                  tag={{ tekst: t('konkurrence.rettetAf', { navn: fornavn(k.rettetAfNavn ?? '') }), tone: 'blaa' }}
                />
              )}
            </span>
          )}
        </span>
        <span className="konk-detalje__total">
          <span className="konk-detalje__total-beloeb">{formatKr(k.total)}</span>
          <span className="konk-detalje__total-antal">
            {k.antalGebyrer === 1 ? t('konkurrence.etGebyr') : t('konkurrence.antalGebyrer', { antal: k.antalGebyrer })}
          </span>
        </span>
      </div>

      {k.annullering && (
        <p className="konk-detalje__annulleret">
          {[t('konkurrence.annulleretAf', { navn: fornavn(k.annullering.afNavn) }), k.annullering.note]
            .filter(Boolean)
            .join(' · ')}
        </p>
      )}

      {podie.length > 0 && (
        <div className="podie konk-detalje__podie">
          {podie.map(({ d, trin }) => (
            <div key={d.medlemId} className={`podie__plads podie__plads--${trin}`}>
              <div className={`podie__knap${d.medlemId === medlemId ? ' podie__knap--egen' : ''}`}>
                <span className="podie__avatar">
                  <Avatar navn={d.navn} size={trin === 1 ? 56 : 48} egen={d.medlemId === medlemId} stiplet={!d.loggetInd} />
                </span>
                <span className="podie__navn">{navn(d)}</span>
                <span className="podie__blok">
                  <span className="konk-detalje__podie-plads">
                    {d.plads === 1 ? t('konkurrence.vinder') : t('konkurrence.plads', { plads: d.plads ?? 0 })}
                  </span>
                  <span className="podie__beloeb">{formatKr(d.beloeb)}</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {(resten.length > 0 || fravaerende.length > 0) && (
        <div className="konk-detalje__liste">
          {resten.length > 0 && <ul className="konk-detalje__gruppe">{resten.map(raekke)}</ul>}
          {fravaerende.length > 0 && (
            <>
              <h2 className="konk-detalje__gruppe-titel">{t('konkurrence.fravaerende')}</h2>
              <ul className="konk-detalje__gruppe">{fravaerende.map(raekke)}</ul>
            </>
          )}
        </div>
      )}

      {children}
    </div>
  );
}

/** Annullér konkurrence: what goes, an optional note, and the red button. */
function AnnullerSheet({
  open,
  onOpenChange,
  k,
  onAnnulleret,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  k: Konkurrence;
  onAnnulleret: () => void;
}) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [fejl, setFejl] = useState<string | null>(null);
  const [klientId] = useState(() => crypto.randomUUID());

  async function annuller(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setFejl(null);
    try {
      await annullerKonkurrence(klientId, k.id, note);
      onAnnulleret();
    } catch (error) {
      setFejl(rpcErrorText(error));
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange} height="partial" title={t('konkurrence.annuller')}>
      <form onSubmit={(e) => void annuller(e)}>
        <p className="felt-note konk-annuller__tekst">
          {t('konkurrence.annullerTekst', { antal: k.antalGebyrer, beloeb: formatKr(k.total) })}
        </p>
        <label className="felt">
          <span className="felt__label">{t('konkurrence.note')}</span>
          <input
            className="felt__input"
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            autoComplete="off"
            maxLength={200}
          />
        </label>
        {fejl && (
          <p className="felt-fejl" role="alert">
            {fejl}
          </p>
        )}
        <button type="submit" className="felt-knap felt-knap--naer konk-annuller__knap" disabled={busy}>
          {t('konkurrence.annuller')}
        </button>
      </form>
    </Sheet>
  );
}
