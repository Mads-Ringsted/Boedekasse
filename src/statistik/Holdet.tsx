import { useLayoutEffect, useRef, useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import { t, type PlainStringId } from '../strings/index.ts';
import { Kort, KortTitel, StatAvatar, Tom } from './dele.tsx';
import { barometerKategori } from './Barometer.tsx';
import {
  hvornaar,
  mestGivne,
  perUge,
  rivaleri,
  stablet,
  stakKategorier,
  stoerst,
  topTre,
} from './statistik.ts';
import { useStat } from './StatistikData.tsx';
import { lokal, mandag } from './tid.ts';

const UGEDAGE: PlainStringId[] = [
  'stat.ugedag.man',
  'stat.ugedag.tir',
  'stat.ugedag.ons',
  'stat.ugedag.tor',
  'stat.ugedag.fre',
  'stat.ugedag.loer',
  'stat.ugedag.soen',
];
const UGEDAGE_LANG: PlainStringId[] = [
  'stat.ugedagLang.man',
  'stat.ugedagLang.tir',
  'stat.ugedagLang.ons',
  'stat.ugedagLang.tor',
  'stat.ugedagLang.fre',
  'stat.ugedagLang.loer',
  'stat.ugedagLang.soen',
];

const to = (n: number) => String(n).padStart(2, '0');

/** The Holdet segment: the whole box's numbers. */
export function Holdet() {
  const s = useStat();
  if (s.boeder.length === 0) return <Tom>{t('stat.ingenEndnu')}</Tom>;
  return (
    <>
      <MestGivne />
      <Hvornaar />
      <GiverOgFaar />
      <PrUge />
      <HvemFaarHvilke />
      <Rivaleri />
    </>
  );
}

function MestGivne() {
  const s = useStat();
  const [alle, setAlle] = useState(false);
  const raekker = mestGivne(s.boeder);
  const dum = barometerKategori(s.kategorier)?.id;
  const viste = alle ? raekker : raekker.slice(0, 5);
  return (
    <div className="stat-kort stat-kort--tabel">
      <div className="stat-tabel__hoved">
        <span className="stat-kort__titel-tekst">{t('stat.mestGivne')}</span>
        <span className="stat-dim">{t('stat.iAlt', { antal: s.boeder.length })}</span>
      </div>
      {viste.map((r, i) => (
        <div key={r.kategoriId ?? ''} className="stat-rang">
          <span className="stat-rang__linje">
            <span className={`stat-rang__nr stat-rang__nr--${Math.min(i + 1, 3)}`}>{i + 1}</span>
            <span className="stat-rang__navn">{s.kategoriNavn(r.kategoriId)}</span>
            <span className="stat-dim">{r.antal}×</span>
          </span>
          <span className="stat-rang__spor">
            <span
              className={`stat-rang__fyld stat-farve--${r.kategoriId === dum ? 'rose' : 'blaa'}`}
              style={{ width: `${Math.max(3, Math.round((r.antal / raekker[0].antal) * 100))}%` }}
            />
          </span>
        </div>
      ))}
      {raekker.length > 5 && (
        <button type="button" className="stat-fold" aria-expanded={alle} onClick={() => setAlle((v) => !v)}>
          {alle ? t('stat.visFaerre') : t('stat.visAlle', { antal: raekker.length })}
        </button>
      )}
    </div>
  );
}

function Hvornaar() {
  const s = useStat();
  const h = hvornaar(s.boeder);
  const topDag = stoerst(h.ugedage);
  const topTime = stoerst(h.timer);
  const maxDag = Math.max(1, ...h.ugedage);
  const maxTime = Math.max(1, ...h.timer);
  return (
    <div className="stat-kort stat-kort--liste">
      <span className="stat-kort__titel-tekst">{t('stat.hvornaar')}</span>
      {h.farligst && (
        <div className="stat-callout">
          <span className="stat-callout__ikon" aria-hidden="true">
            <TriangleAlert size={20} strokeWidth={2} />
          </span>
          <span className="stat-callout__tekst">
            <span className="stat-callout__label">{t('stat.farligste')}</span>
            <span className="stat-callout__vaerdi">
              {t('stat.dagKl', {
                dag: t(UGEDAGE_LANG[h.farligst.ugedag]),
                fra: to(h.farligst.time),
                til: to(h.farligst.time + 1),
              })}
            </span>
          </span>
          <span className="stat-dim">{t('stat.boeder', { antal: h.farligst.antal })}</span>
        </div>
      )}
      <span className="stat-graf__label">{t('stat.ugedag')}</span>
      <div
        className="stat-soejler stat-soejler--7"
        role="img"
        aria-label={h.ugedage.map((v, i) => `${t(UGEDAGE[i])} ${v}`).join(', ')}
      >
        {h.ugedage.map((v, i) => (
          <span
            key={i}
            className={`stat-soejle${i === topDag ? ' stat-soejle--top' : ''}`}
            style={{ height: `${Math.max(2, (v / maxDag) * 100)}%` }}
          />
        ))}
      </div>
      <div className="stat-akse stat-akse--7" aria-hidden="true">
        {UGEDAGE.map((d, i) => (
          <span key={d} className={i === topDag ? 'stat-akse--valgt' : undefined}>
            {t(d)}
          </span>
        ))}
      </div>
      <span className="stat-graf__label stat-graf__label--luft">{t('stat.timePaaDoegnet')}</span>
      <div
        className="stat-soejler stat-soejler--24"
        role="img"
        aria-label={t('stat.timerLabel', { time: to(Math.max(0, topTime)) })}
      >
        {h.timer.map((v, i) => (
          <span
            key={i}
            className={`stat-soejle stat-soejle--tynd${i === topTime ? ' stat-soejle--top' : ''}`}
            style={{ height: `${Math.max(2, (v / maxTime) * 100)}%` }}
          />
        ))}
      </div>
      <div className="stat-akse stat-akse--4" aria-hidden="true">
        <span>00</span>
        <span>06</span>
        <span>12</span>
        <span>18</span>
      </div>
    </div>
  );
}

function GiverOgFaar() {
  const s = useStat();
  const top = topTre(s.boeder);
  const liste = (rk: { medlemId: string; antal: number }[]) =>
    rk.map((r) => (
      <span key={r.medlemId} className="stat-top3__raekke">
        <StatAvatar medlemId={r.medlemId} size={28} />
        <span className="stat-top3__navn">{s.navn(r.medlemId)}</span>
        <span className="stat-top3__tal">{r.antal}</span>
      </span>
    ));
  return (
    <div className="stat-kort stat-kort--liste">
      <span className="stat-kort__titel-tekst">{t('stat.giverOgFaar')}</span>
      <div className="stat-to stat-to--luft">
        <div className="stat-top3">
          <span className="stat-top3__label stat-tekst--blaa">{t('stat.giverFlest')}</span>
          {liste(top.givere)}
        </div>
        <div className="stat-top3">
          <span className="stat-top3__label stat-tekst--rose">{t('stat.faarFlest')}</span>
          {liste(top.modtagere)}
        </div>
      </div>
    </div>
  );
}

const UGE_BREDDE = 36;

function PrUge() {
  const s = useStat();
  const start = s.saeson?.startet ?? s.slut;
  const uger = perUge(s.boeder, start, s.slut);
  const rul = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (rul.current) rul.current.scrollLeft = rul.current.scrollWidth;
  }, [uger.length]);
  if (uger.length === 0) return null;

  const max = Math.max(1, ...uger.map((u) => u.antal));
  const top = stoerst(uger.map((u) => u.antal));
  const bredde = uger.length * UGE_BREDDE;
  const x = (i: number) => 18 + i * UGE_BREDDE;
  const y = (v: number) => 112 - (v / max) * 96;
  const nuUge = s.koerer ? mandag(lokal(s.slut).dato) : null;
  const punkter = uger.map((u, i) => `${x(i)},${y(u.antal)}`).join(' ');
  const flade = `M${x(0)} 112 L${uger.map((u, i) => `${x(i)} ${y(u.antal)}`).join(' L')} L${x(uger.length - 1)} 112 Z`;

  return (
    <div className="stat-kort stat-kort--liste">
      <KortTitel titel={t('stat.prUge')} ekstra={uger.length > 9 ? t('stat.swipe') : undefined} />
      <div className="stat-rul" ref={rul}>
        <svg
          width={Math.max(bredde, 300)}
          height="136"
          viewBox={`0 0 ${Math.max(bredde, 300)} 136`}
          role="img"
          aria-label={t('stat.prUgeLabel', { fra: uger[0].nr, nr: uger[top]?.nr ?? 0, antal: max })}
        >
          <line x1="0" y1="112" x2={Math.max(bredde, 300)} y2="112" stroke="var(--color-line)" strokeWidth="1" />
          <path d={flade} fill="var(--color-accent)" fillOpacity="0.14" />
          <polyline
            points={punkter}
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {uger.map((u, i) => {
            const erNu = u.mandag === nuUge;
            const erTop = i === top;
            return (
              <g key={u.mandag}>
                {erNu ? (
                  <circle cx={x(i)} cy={y(u.antal)} r="4" fill="var(--color-bg)" stroke="var(--color-accent-text)" strokeWidth="2" />
                ) : (
                  <circle cx={x(i)} cy={y(u.antal)} r={erTop ? 5 : 3} fill="var(--color-accent)" />
                )}
                <text
                  x={x(i)}
                  y={y(u.antal) - (erTop ? 9 : 11)}
                  textAnchor="middle"
                  fontSize="11"
                  fill={erTop ? 'var(--color-text)' : 'var(--color-text-muted)'}
                  fontWeight={erTop ? 700 : 400}
                >
                  {u.antal}
                </text>
                <text
                  x={x(i)}
                  y="130"
                  textAnchor="middle"
                  fontSize="10"
                  fill={erNu ? 'var(--color-accent-text)' : erTop ? 'var(--color-text)' : 'var(--color-text-muted)'}
                  fontWeight={erTop ? 600 : 400}
                >
                  {erNu ? t('stat.nu') : t('stat.uge', { nr: u.nr })}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      {top >= 0 && (
        <span className="stat-dim stat-dim--lille">
          {t('stat.hoejesteUge', { uge: t('stat.uge', { nr: uger[top].nr }), antal: uger[top].antal })}
        </span>
      )}
    </div>
  );
}

/** The stacked bar colours, in order; the last is Andre. */
const STAK_FARVER = ['blaa', 'blaa-lys', 'groen', 'graa-lys'] as const;

function HvemFaarHvilke() {
  const s = useStat();
  const chips = stakKategorier(s.boeder, s.slut);
  const [valgt, setValgt] = useState<string | null>(null);
  const kategori = chips.includes(valgt ?? '') ? (valgt as string) : chips[0];
  if (!kategori) return null;

  const data = stablet(s.boeder, kategori, s.slut);
  const max = Math.max(1, ...data.uger.map((u) => u.total));
  const pr = Math.min(14, 128 / max);
  const top = stoerst(data.uger.map((u) => u.total));
  const nuUge = s.koerer ? mandag(lokal(s.slut).dato) : null;
  const farve = (id: string | null) => (id === null ? 'andre' : STAK_FARVER[data.personer.indexOf(id)]);

  return (
    <div className="stat-kort stat-kort--liste stat-kort--luft">
      <KortTitel titel={t('stat.hvemFaarHvilke')} ekstra={t('stat.sidste8Uger')} />
      <div className="stat-chips" role="group" aria-label={t('stat.vaelgBoede')}>
        {chips.map((k) => (
          <button key={k} type="button" className="stat-chip" aria-pressed={k === kategori} onClick={() => setValgt(k)}>
            {s.kategoriNavn(k)}
          </button>
        ))}
      </div>
      <div className="stat-stak" role="img" aria-label={t('stat.stakLabel', { kategori: s.kategoriNavn(kategori) })}>
        {data.uger.map((u, i) => (
          <span key={u.mandag} className="stat-stak__uge">
            <span className={`stat-stak__total${i === top ? ' stat-stak__total--top' : ''}`}>{u.total}</span>
            <span className="stat-stak__soejle">
              {u.stakke
                .filter((st) => st.antal > 0)
                .map((st) => (
                  <span
                    key={st.medlemId ?? 'andre'}
                    className={`stat-stak__del stat-stak--${farve(st.medlemId)}`}
                    style={{ height: `${st.antal * pr}px` }}
                  />
                ))}
            </span>
            <span className="stat-stak__label">{u.mandag === nuUge ? t('stat.nu') : t('stat.uge', { nr: u.nr })}</span>
          </span>
        ))}
      </div>
      <div className="stat-forklaring">
        {data.personer.map((id) => (
          <span key={id} className="stat-forklaring__punkt">
            <span className={`stat-forklaring__farve stat-stak--${farve(id)}`} />
            {s.navn(id)}
          </span>
        ))}
        {data.medAndre && (
          <span className="stat-forklaring__punkt">
            <span className="stat-forklaring__farve stat-stak--andre" />
            {t('stat.andre')}
          </span>
        )}
      </div>
      {data.top && (
        <span className="stat-dim stat-dim--lille">
          {data.top.medlemId === s.migId
            ? t('stat.stakNoteDig', { kategori: s.kategoriNavn(kategori), antal: data.top.antal })
            : t('stat.stakNote', { navn: s.navn(data.top.medlemId), kategori: s.kategoriNavn(kategori), antal: data.top.antal })}
        </span>
      )}
    </div>
  );
}

function Rivaleri() {
  const s = useStat();
  const r = rivaleri(s.boeder);
  if (!r) return null;
  // You go second: "Jonas og dig".
  const [a, b, x, y] = r.a === s.migId ? [r.b, r.a, r.bTilA, r.aTilB] : [r.a, r.b, r.aTilB, r.bTilA];
  return (
    <Kort className="stat-rival">
      <span className="stat-rival__avatarer">
        <StatAvatar medlemId={a} size={36} />
        <StatAvatar medlemId={b} size={36} />
      </span>
      <span className="stat-rival__tekst">
        <span className="stat-kort__titel-tekst">{t('stat.rivaleri')}</span>
        <span className="stat-dim">
          {t('stat.rivaleriLinje', { a: s.navn(a), b: s.navnObjekt(b), x, y })}
        </span>
      </span>
    </Kort>
  );
}
