import type { ReactNode } from 'react';
import { Flame } from 'lucide-react';
import { kortDato } from '../kategorier/kategoriListe.ts';
import { formatKr, t } from '../strings/index.ts';
import { decimal, StatAvatar, Tom } from './dele.tsx';
import { antalBoeder } from './Dig.tsx';
import {
  ankeKongen,
  ankeTaberen,
  dyresteAften,
  dyresteDagForEn,
  flestPaaEnAften,
  hurtigstTilAtBetale,
  kassenOverTid,
  laengstUden,
} from './statistik.ts';
import { useStat } from './StatistikData.tsx';

const maaned = new Intl.DateTimeFormat('da', { timeZone: 'Europe/Copenhagen', month: 'short' });
/** A Copenhagen evening date (`YYYY-MM-DD`) as "12. dec". */
const aftenDato = (dato: string) => kortDato(`${dato}T12:00:00Z`);

/** The Rekorder segment: Kassen over tid and the Sæson's records. */
export function Rekorder() {
  const s = useStat();
  if (s.boeder.length === 0 && s.charges.length === 0) return <Tom>{t('stat.ingenEndnu')}</Tom>;

  const aften = dyresteAften(s.boeder);
  const dag = dyresteDagForEn(s.boeder);
  const flest = flestPaaEnAften(s.boeder);
  const uden = s.saeson ? laengstUden(s.boeder, s.medlemmer, s.saeson.startet, s.slut, s.koerer) : null;
  const hurtig = hurtigstTilAtBetale(s.charges, s.indbetalinger);
  const konge = ankeKongen(s.boeder);
  const taber = ankeTaberen(s.boeder);

  return (
    <>
      <KassenOverTid />
      <div className="stat-kort stat-kort--tabel">
        {aften && (
          <Rekord
            ikon={
              <span className="stat-rekord__ikon" aria-hidden="true">
                <Flame size={18} strokeWidth={2} />
              </span>
            }
            titel={t('stat.rek.dyresteAften')}
            under={t('stat.rek.datoAntal', { dato: aftenDato(aften.aften), antal: antalBoeder(aften.antal) })}
            vaerdi={formatKr(aften.kr)}
          />
        )}
        {dag && (
          <Rekord
            ikon={<StatAvatar medlemId={dag.medlemId} size={32} />}
            titel={t('stat.rek.dyresteDag')}
            under={t('stat.rek.navnDatoAntal', {
              navn: s.navn(dag.medlemId),
              dato: aftenDato(dag.aften),
              antal: antalBoeder(dag.antal),
            })}
            vaerdi={formatKr(dag.kr)}
          />
        )}
        {flest && (
          <Rekord
            ikon={<StatAvatar medlemId={flest.medlemId} size={32} />}
            titel={t('stat.rek.flestPaaEnAften')}
            under={t('stat.rek.navnDato', { navn: s.navn(flest.medlemId), dato: aftenDato(flest.aften) })}
            vaerdi={String(flest.antal)}
          />
        )}
        {uden && (
          <Rekord
            ikon={<StatAvatar medlemId={uden.medlemId} size={32} />}
            titel={t('stat.rek.laengstUden')}
            under={uden.iGang ? t('stat.rek.stadigIGang', { navn: s.navn(uden.medlemId) }) : s.navn(uden.medlemId)}
            vaerdi={uden.dage === 1 ? t('stat.rek.enDag') : t('stat.rek.dage', { antal: uden.dage })}
          />
        )}
        {hurtig && (
          <Rekord
            ikon={<StatAvatar medlemId={hurtig.medlemId} size={32} />}
            titel={t('stat.rek.hurtigst')}
            under={t('stat.rek.iSnit', { navn: s.navn(hurtig.medlemId) })}
            vaerdi={hurtig.dage === 1 ? t('stat.rek.enDag') : t('stat.rek.dage', { antal: decimal(hurtig.dage) })}
          />
        )}
        {konge && (
          <Rekord
            ikon={<StatAvatar medlemId={konge.medlemId} size={32} />}
            titel={t('stat.rek.ankeKongen')}
            under={t('stat.rek.vundet', { navn: s.navn(konge.medlemId), vundet: konge.vundet, afgjort: konge.afgjort })}
            vaerdi={`${Math.round((konge.vundet / konge.afgjort) * 100)}%`}
          />
        )}
        {taber && (
          <Rekord
            ikon={<StatAvatar medlemId={taber.medlemId} size={32} />}
            titel={t('stat.rek.ankeTaberen')}
            under={t('stat.rek.tabt', {
              navn: s.navn(taber.medlemId),
              tabt: taber.afgjort - taber.vundet,
              afgjort: taber.afgjort,
            })}
            vaerdi={`${Math.round((taber.vundet / taber.afgjort) * 100)}%`}
          />
        )}
      </div>
    </>
  );
}

function Rekord({ ikon, titel, under, vaerdi }: { ikon: ReactNode; titel: string; under: string; vaerdi: string }) {
  return (
    <div className="stat-linje">
      {ikon}
      <span className="stat-linje__tekst">
        <span className="stat-linje__navn">{titel}</span>
        <span className="stat-dim">{under}</span>
      </span>
      <span className="stat-linje__vaerdi">{vaerdi}</span>
    </div>
  );
}

const B = 329;
const H = 80;

/** The box's Bøder and Gebyrer added up across the Sæson. */
function KassenOverTid() {
  const s = useStat();
  const punkter = kassenOverTid(s.charges);
  const ialt = punkter[punkter.length - 1]?.ialt ?? 0;
  const start = Date.parse(s.saeson?.startet ?? s.slut);
  const slut = Math.max(start + 1, Date.parse(s.slut));
  const x = (tid: number) => 2 + ((tid - start) / (slut - start)) * (B - 4);
  const y = (v: number) => H - 4 - (ialt > 0 ? (v / ialt) * (H - 12) : 0);
  const linje = [
    `${x(start)},${y(0)}`,
    ...punkter.map((p) => `${x(Date.parse(p.tid))},${y(p.ialt)}`),
    `${x(slut)},${y(ialt)}`,
  ].join(' ');

  // One label per month the Sæson touches (at most 6, evenly picked).
  const maaneder: string[] = [];
  for (let d = new Date(start); d.getTime() <= slut; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
    const navn = maaned.format(d).replace(/\.$/, '');
    if (maaneder[maaneder.length - 1] !== navn) maaneder.push(navn);
  }
  const vist = maaneder.length <= 6 ? maaneder : maaneder.filter((_, i) => i % Math.ceil(maaneder.length / 6) === 0);

  return (
    <div className="stat-kort stat-kort--liste stat-kort--taet">
      <div className="stat-tabel__hoved stat-tabel__hoved--flad">
        <span className="stat-kort__titel-tekst">{t('stat.rek.kassen')}</span>
        <span className="stat-kassen__ialt">{formatKr(ialt)}</span>
      </div>
      <svg
        className="stat-kassen__graf"
        viewBox={`0 0 ${B} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={t('stat.rek.kassenLabel', { kr: formatKr(ialt) })}
      >
        <path d={`M${linje.replaceAll(' ', ' L')} L${x(slut)} ${H - 2} L${x(start)} ${H - 2} Z`} fill="var(--color-accent)" fillOpacity="0.15" />
        <polyline
          points={linje}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="stat-akse stat-akse--spredt" aria-hidden="true">
        {vist.map((m) => (
          <span key={m}>{m.charAt(0).toLocaleUpperCase('da') + m.slice(1)}</span>
        ))}
      </div>
    </div>
  );
}
