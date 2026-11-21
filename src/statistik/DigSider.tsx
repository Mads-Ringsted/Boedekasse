import type { ReactNode } from 'react';
import { Skull, Swords, Target } from 'lucide-react';
import { useNavigate } from 'react-router';
import { dagOverskrift } from '../aktivitet/tid.ts';
import { BackButton } from '../components/BackButton.tsx';
import { Screen } from '../components/Screen.tsx';
import { useGivBoeder } from '../giv/GivBoederProvider.tsx';
import { useSaeson } from '../saeson/SaesonProvider.tsx';
import { formatKr, t } from '../strings/index.ts';
import { antalBoeder, useAabnSide } from './Dig.tsx';
import { Sommerfugl, SommerfuglHoved, StatAvatar, Tom } from './dele.tsx';
import {
  digTal,
  engel,
  favorit,
  mellem,
  mineKategorier,
  modparter,
  nemesis,
  skydeskive,
  vaabenhvile,
  type Modpart,
} from './statistik.ts';
import { useStat } from './StatistikData.tsx';

/** A pushed Statistik page: "‹ Statistik", then the content. */
function Side({ titel, under, children }: { titel?: string; under?: string; children: ReactNode }) {
  const navigate = useNavigate();
  const tilbage = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    void (idx > 0 ? navigate(-1) : navigate('/statistik'));
  };
  return (
    <Screen>
      <BackButton label={t('skaerm.statistik')} onClick={tilbage} />
      {titel && (
        <div className="stat-side__hoved">
          <h1 className="stat-side__titel">{titel}</h1>
          {under && <span className="stat-side__under">{under}</span>}
        </div>
      )}
      {children}
    </Screen>
  );
}

/** "Jonas'" / "Emils". */
const genitiv = (navn: string) => (/[sxz]$/i.test(navn) ? `${navn}'` : `${navn}s`);

/** Nemesis: who fines you most (with "Tag hævn"), and who you fine most. */
export function NemesisSide() {
  const s = useStat();
  const { aabn } = useGivBoeder();
  const { pause } = useSaeson();
  const parter = modparter(s.boeder, s.medlemmer, s.migId);
  const nem = nemesis(parter);
  const skyd = skydeskive(parter);
  const mine = digTal(s.boeder, s.migId);

  return (
    <Side>
      {!nem && !skyd && <Tom>{t('stat.ingenEndnu')}</Tom>}
      {nem && (
        <div className="stat-kort stat-stort stat-stort--rose">
          <div className="stat-stort__top">
            <span className="stat-ring stat-ring--rose">
              <StatAvatar medlemId={nem.medlemId} size={72} />
            </span>
            <div className="stat-stort__tekst">
              <span className="stat-stort__rolle stat-tekst--rose">
                <Skull size={14} strokeWidth={2} aria-hidden="true" />
                {t('stat.dinBoedeNemesis')}
              </span>
              <span className="stat-stort__navn">{s.navn(nem.medlemId)}</span>
              <span className="stat-stort__under">
                {t('stat.tilDigKr', { antal: antalBoeder(nem.fik), kr: formatKr(nem.fikKr) })}
              </span>
            </div>
          </div>
          <div className="stat-stort__mellem">
            <div className="stat-stort__mellem-tekst">
              <span>{t('stat.duHarGivet', { navn: s.navn(nem.medlemId), antal: nem.gav })}</span>
              <span>{t('stat.harGivetDig', { navn: s.navn(nem.medlemId), antal: nem.fik })}</span>
            </div>
            <div className="stat-split" aria-hidden="true">
              {nem.gav > 0 && <span className="stat-farve--blaa" style={{ flex: nem.gav }} />}
              <span className="stat-farve--rose" style={{ flex: nem.fik }} />
            </div>
          </div>
          <Favorit giverId={nem.medlemId} modtagerId={s.migId} navn={genitiv(s.navn(nem.medlemId))} />
          {s.koerer && !pause && !s.erUdmeldt(nem.medlemId) && (
            <button type="button" className="stat-knap stat-knap--rose" onClick={() => aabn({ medlemId: nem.medlemId })}>
              <Swords size={18} strokeWidth={2.2} aria-hidden="true" />
              {t('stat.tagHaevn', { navn: s.navn(nem.medlemId) })}
            </button>
          )}
        </div>
      )}
      {skyd && <Skydeskive p={skyd} ialt={mine.givet.antal} />}
    </Side>
  );
}

function Favorit({ giverId, modtagerId, navn }: { giverId: string; modtagerId: string; navn: string }) {
  const s = useStat();
  const fav = favorit(s.boeder, giverId, modtagerId);
  if (!fav) return null;
  return (
    <span className="stat-stort__linje">
      {t('stat.favoritTilDig', { navn })}{' '}
      <strong>{s.kategoriNavn(fav.kategoriId)}</strong> ({fav.antal}×)
    </span>
  );
}

function Skydeskive({ p, ialt }: { p: Modpart; ialt: number }) {
  const s = useStat();
  const fav = favorit(s.boeder, s.migId, p.medlemId);
  const m = mellem(s.boeder, s.migId, p.medlemId);
  const navn = s.navn(p.medlemId);
  return (
    <div className="stat-kort stat-stort stat-stort--blaa">
      <div className="stat-stort__top">
        <span className="stat-skive">
          <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden="true">
            <circle cx="36" cy="36" r="34" fill="none" stroke="var(--color-accent)" strokeWidth="2" />
            <circle cx="36" cy="36" r="29" fill="none" stroke="var(--color-accent)" strokeWidth="1" strokeDasharray="3 4" />
          </svg>
          <StatAvatar medlemId={p.medlemId} size={56} />
        </span>
        <div className="stat-stort__tekst">
          <span className="stat-stort__rolle stat-tekst--blaa">
            <Target size={14} strokeWidth={2} aria-hidden="true" />
            {t('stat.dinSkydeskive')}
          </span>
          <span className="stat-stort__navn">{navn}</span>
          <span className="stat-stort__under">{t('stat.fraDigKr', { antal: antalBoeder(p.gav), kr: formatKr(p.gavKr) })}</span>
        </div>
      </div>
      <div className="stat-fliser">
        <div className="stat-flise">
          <span className="stat-flise__label">{t('stat.mestFor')}</span>
          <span className="stat-flise__vaerdi">{fav ? s.kategoriNavn(fav.kategoriId) : '–'}</span>
        </div>
        <div className="stat-flise">
          <span className="stat-flise__label">{t('stat.senest')}</span>
          <span className="stat-flise__vaerdi">{m.seneste ? dagOverskrift(m.seneste) : '–'}</span>
        </div>
        <div className="stat-flise">
          <span className="stat-flise__label">{t('stat.anket')}</span>
          <span className="stat-flise__vaerdi">{t('stat.afAntal', { del: m.anket, ialt: m.antal })}</span>
        </div>
      </div>
      {ialt > 0 && (
        <span className="stat-stort__linje">
          {t('stat.andelTil', { pct: Math.round((p.gav / ialt) * 100), navn })}
        </span>
      )}
    </div>
  );
}

/** Dig og de andre: a butterfly chart per Medlem, then four small role cards. */
export function DigOgDeAndre() {
  const s = useStat();
  const aabn = useAabnSide();
  const parter = modparter(s.boeder, s.medlemmer, s.migId);
  const max = Math.max(1, ...parter.flatMap((p) => [p.gav, p.fik]));
  const nem = nemesis(parter);
  const skyd = skydeskive(parter);
  const eng = engel(parter, s.medlemmer);
  const fred = vaabenhvile(parter, s.medlemmer);

  return (
    <Side titel={t('stat.digOgDeAndre')} under={t('stat.digOgDeAndreUnder')}>
      <div className="stat-kort stat-kort--stor">
        <SommerfuglHoved venstre={t('stat.duGav')} hoejre={t('stat.duFik')} />
        {parter.length === 0 ? (
          <Tom>{t('stat.ingenAndre')}</Tom>
        ) : (
          parter.map((p) => (
            <Sommerfugl key={p.medlemId} midte={s.navn(p.medlemId)} gav={p.gav} fik={p.fik} max={max} />
          ))
        )}
      </div>
      <div className="stat-to">
        {nem && (
          <RolleKort
            farve="rose"
            rolle={t('stat.dinNemesis')}
            medlemId={nem.medlemId}
            under={t('stat.tilOgFra', { til: nem.fik, fra: nem.gav })}
            onClick={() => aabn('nemesis')}
          />
        )}
        {skyd && (
          <RolleKort
            farve="blaa"
            rolle={t('stat.dinSkydeskive')}
            medlemId={skyd.medlemId}
            under={t('stat.fraOgTil', { fra: skyd.gav, til: skyd.fik })}
            onClick={() => aabn('nemesis')}
          />
        )}
        {eng && (
          <RolleKort farve="groen" rolle={t('stat.dinEngel')} medlemId={eng.medlemId} under={t('stat.dinEngelUnder')} />
        )}
        {fred && (
          <RolleKort farve="graa" rolle={t('stat.vaabenhvile')} medlemId={fred.medlemId} under={t('stat.vaabenhvileUnder')} />
        )}
      </div>
    </Side>
  );
}

function RolleKort({
  farve,
  rolle,
  medlemId,
  under,
  onClick,
}: {
  farve: 'rose' | 'blaa' | 'groen' | 'graa';
  rolle: string;
  medlemId: string;
  under: string;
  onClick?: () => void;
}) {
  const s = useStat();
  const indhold = (
    <>
      <span className={`stat-rolle__rolle stat-tekst--${farve}`}>{rolle}</span>
      <span className="stat-rolle__person">
        <StatAvatar medlemId={medlemId} size={32} />
        <span className="stat-rolle__navn">{s.navn(medlemId)}</span>
      </span>
      <span className="stat-rolle__under">{under}</span>
    </>
  );
  const klasse = `stat-kort stat-rolle${farve === 'rose' ? ' stat-person--rose' : farve === 'blaa' ? ' stat-person--blaa' : ''}`;
  return onClick ? (
    <button type="button" className={klasse} onClick={onClick}>
      {indhold}
    </button>
  ) : (
    <div className={klasse}>{indhold}</div>
  );
}

/** Dine bødetyper: a butterfly chart per Bødekategori, your favourite and the ones you never gave. */
export function DineBoedetyper() {
  const s = useStat();
  const raekker = mineKategorier(s.boeder, s.migId);
  const tal = digTal(s.boeder, s.migId);
  const max = Math.max(1, ...raekker.flatMap((r) => [r.gav, r.fik]));
  const yndling = [...raekker].sort((a, b) => b.gav - a.gav)[0];
  const givne = new Set(raekker.filter((r) => r.gav > 0).map((r) => r.kategoriId));
  const brugt = new Map<string, number>();
  for (const b of s.boeder) if (b.kategoriId) brugt.set(b.kategoriId, (brugt.get(b.kategoriId) ?? 0) + 1);
  const aldrig = s.kategorier
    .filter((k) => !k.arkiveret && !givne.has(k.id))
    .sort((a, b) => (brugt.get(b.id) ?? 0) - (brugt.get(a.id) ?? 0) || a.navn.localeCompare(b.navn, 'da'));

  return (
    <Side titel={t('stat.dineBoedetyper')} under={t('stat.dineBoedetyperUnder')}>
      <div className="stat-kort stat-kort--stor">
        <SommerfuglHoved
          venstre={t('stat.duGavAntal', { antal: tal.givet.antal })}
          hoejre={t('stat.duFikAntal', { antal: tal.faaet.antal })}
          bred
        />
        {raekker.length === 0 ? (
          <Tom>{t('stat.ingenEndnu')}</Tom>
        ) : (
          raekker.map((r) => (
            <Sommerfugl
              key={r.kategoriId ?? ''}
              midte={s.kategoriNavn(r.kategoriId)}
              gav={r.gav}
              fik={r.fik}
              max={max}
              bred
            />
          ))
        )}
      </div>
      <div className="stat-to">
        {yndling && yndling.gav > 0 && (
          <div className="stat-kort stat-lille">
            <span className="stat-lille__label">{t('stat.yndlingsboede')}</span>
            <span className="stat-lille__vaerdi">{s.kategoriNavn(yndling.kategoriId)}</span>
            <span className="stat-lille__label">
              {t('stat.afDemDuGiver', { pct: Math.round((yndling.gav / Math.max(1, tal.givet.antal)) * 100) })}
            </span>
          </div>
        )}
        {aldrig.length > 0 && (
          <div className="stat-kort stat-lille">
            <span className="stat-lille__label">{t('stat.harAldrigGivet')}</span>
            <span className="stat-lille__vaerdi">{aldrig[0].navn}</span>
            {aldrig.length > 1 && (
              <span className="stat-lille__label">
                {aldrig.length === 2 ? t('stat.ogEnAnden') : t('stat.ogAndre', { antal: aldrig.length - 1 })}
              </span>
            )}
          </div>
        )}
      </div>
    </Side>
  );
}
