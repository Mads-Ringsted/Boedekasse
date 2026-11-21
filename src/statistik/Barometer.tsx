import { useState } from 'react';
import { Share } from 'lucide-react';
import { dagOverskrift, givetTekst } from '../aktivitet/tid.ts';
import { useBodekasse } from '../bodekasse/BodekasseProvider.tsx';
import { t } from '../strings/index.ts';
import { StatAvatar, Tom } from './dele.tsx';
import type { StatKategori } from './hentStatistik.ts';
import { KlovnAvatar } from './Klovn.tsx';
import { barometer, placer, type BarometerPlads } from './statistik.ts';
import { useStat } from './StatistikData.tsx';

/** The Barometer's Bødekategori, found by name (case ignored). */
export const BAROMETER_NAVN = 'Der ser du dum ud';

export function barometerKategori(kategorier: readonly StatKategori[]): StatKategori | null {
  const navn = BAROMETER_NAVN.toLocaleLowerCase('da');
  return kategorier.find((k) => k.navn.trim().toLocaleLowerCase('da') === navn) ?? null;
}

const SOEJLE = 330;
const HOEJDE = { 1: 76, 2: 56, 3: 40, 0: 40 } as const;
const GRUPPE = 48;
const LUFT = 10;

const gange = (n: number) => (n === 1 ? t('stat.enGang') : t('stat.gange', { antal: n }));
const smaat = (s: string) => s.charAt(0).toLocaleLowerCase('da') + s.slice(1);

/** The Barometer segment: who looks most silly this Sæson. */
export function Barometer() {
  const s = useStat();
  const kategori = barometerKategori(s.kategorier);
  if (!kategori) {
    return (
      <div className="stat-kort stat-kort--liste">
        <span className="stat-kort__titel-tekst">{t('stat.barometer.ingenTitel')}</span>
        <Tom>{t('stat.barometer.ingenTekst', { navn: BAROMETER_NAVN })}</Tom>
      </div>
    );
  }
  const pladser = barometer(s.boeder, kategori.id, s.medlemmer);
  const nr1 = pladser[0]?.antal > 0 ? pladser[0] : null;
  const seneste = s.boeder
    .filter((b) => b.kategoriId === kategori.id)
    .sort((a, b) => Date.parse(b.givet) - Date.parse(a.givet))
    .slice(0, 5);

  return (
    <>
      {!s.koerer && nr1 && <Klovnen plads={nr1} kategori={kategori.navn} />}
      <Termometer pladser={pladser} />
      <div className="stat-kort stat-kort--tabel">
        <div className="stat-tabel__hoved">
          <span className="stat-kort__titel-tekst">{t('stat.senesteGange')}</span>
        </div>
        {seneste.length === 0 ? (
          <div className="stat-tabel__tom">
            <Tom>{t('stat.barometer.ingen')}</Tom>
          </div>
        ) : (
          seneste.map((b) => (
            <div key={b.id} className="stat-linje">
              <StatAvatar medlemId={b.modtagerId} size={32} />
              <span className="stat-linje__tekst">
                <span className="stat-linje__navn">{s.navn(b.modtagerId)}</span>
                <span className="stat-dim">
                  {t('stat.fraNavnTid', { navn: s.navnObjekt(b.giverId), tid: givetTekst(b.givet) })}
                </span>
              </span>
            </div>
          ))
        )}
      </div>
    </>
  );
}

/** "Sæsonens klovn": only once the Sæson has ended. */
function Klovnen({ plads, kategori }: { plads: BarometerPlads; kategori: string }) {
  const s = useStat();
  const { bodekasseNavn } = useBodekasse();
  const [kopieret, setKopieret] = useState(false);

  async function del() {
    const text = t('stat.klovn.delTekst', {
      navn: s.medlemmer.find((m) => m.id === plads.medlemId)?.navn ?? '',
      saeson: s.saeson?.navn ?? '',
      kasse: bodekasseNavn,
      antal: plads.antal,
      kategori,
    });
    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setKopieret(true);
      setTimeout(() => setKopieret(false), 2000);
    } catch {
      // Nothing to do: the card is still on screen.
    }
  }

  return (
    <div className="stat-kort stat-klovn">
      <span className="stat-klovn__titel">{t('stat.klovn.titel')}</span>
      <KlovnAvatar medlemId={plads.medlemId} niveau={1} size={88} />
      <span className="stat-klovn__navn">{s.navn(plads.medlemId)}</span>
      <span className="stat-klovn__under">
        {t('stat.klovn.under', {
          antal: plads.antal,
          kategori,
          senest: plads.seneste ? smaat(dagOverskrift(plads.seneste)) : '',
        })}
      </span>
      <button type="button" className="stat-knap stat-knap--rose stat-knap--pille" onClick={() => void del()}>
        <Share size={16} strokeWidth={2.4} aria-hidden="true" />
        {kopieret ? t('stat.klovn.kopieret') : t('stat.klovn.del')}
      </button>
    </div>
  );
}

type Raekke =
  | { art: 'en'; plads: BarometerPlads; hoejde: number }
  | { art: 'gruppe'; pladser: BarometerPlads[]; hoejde: number };

function Termometer({ pladser }: { pladser: BarometerPlads[] }) {
  const s = useStat();
  // The clowns, then you, one row each; everyone else shares the bottom row.
  const enkelte = pladser.filter((p) => p.klovn > 0 || (p.medlemId === s.migId && p.antal > 0));
  const resten = pladser.filter((p) => !enkelte.includes(p));
  const raekker: Raekke[] = [
    ...enkelte.map((p): Raekke => ({ art: 'en', plads: p, hoejde: HOEJDE[p.klovn] })),
    ...(resten.length > 0 ? [{ art: 'gruppe' as const, pladser: resten, hoejde: GRUPPE }] : []),
  ];
  // The shared row always sits at the bottom.
  const antal = raekker.map((r) => (r.art === 'en' ? r.plads.antal : 0));
  const tops = placer(
    antal,
    raekker.map((r) => r.hoejde + LUFT),
    SOEJLE + LUFT,
  );
  const fyld = raekker.length > 0 && antal[0] > 0 ? SOEJLE - (tops[0] + raekker[0].hoejde / 2) : 0;

  return (
    <div className="stat-kort stat-termo-kort">
      <span className="stat-termo__label">{t('stat.barometer.top')}</span>
      <div className="stat-termo" style={{ height: SOEJLE }}>
        <div className="stat-termo__roer" aria-hidden="true">
          <span className="stat-termo__fyld" style={{ height: Math.max(0, fyld) }} />
        </div>
        <div className="stat-termo__kugle" aria-hidden="true" />
        {raekker.map((r, i) => (
          <div
            key={r.art === 'en' ? r.plads.medlemId : 'gruppe'}
            className="stat-termo__raekke"
            style={{ top: tops[i], height: r.hoejde }}
          >
            <span className="stat-termo__streg" aria-hidden="true" />
            {r.art === 'en' ? (
              <>
                <KlovnAvatar medlemId={r.plads.medlemId} niveau={r.plads.klovn} size={r.plads.klovn === 1 ? 48 : 40} />
                <span className="stat-termo__tekst">
                  <span className={`stat-termo__navn${r.plads.klovn === 1 ? ' stat-termo__navn--top' : ''}`}>
                    {s.navn(r.plads.medlemId)}
                  </span>
                  <span className={r.plads.klovn === 1 ? 'stat-tekst--rose stat-lille-tekst' : 'stat-dim'}>
                    {gange(r.plads.antal)}
                  </span>
                </span>
              </>
            ) : (
              <>
                <span className="stat-stablede">
                  {r.pladser.slice(0, 4).map((p) => (
                    <StatAvatar key={p.medlemId} medlemId={p.medlemId} size={32} />
                  ))}
                </span>
                <span className="stat-termo__gruppe">
                  {[
                    ...r.pladser.map((p) => `${s.navn(p.medlemId)} ${p.antal}`),
                    ...(r.pladser.every((p) => p.antal <= 1) ? [t('stat.barometer.serFineUd')] : []),
                  ].join(' · ')}
                </span>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
