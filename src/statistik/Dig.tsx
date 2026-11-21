import { Target, Skull } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router';
import { formatKr, t } from '../strings/index.ts';
import { Bjaelke, decimal, Kort, KortTitel, StatAvatar, Tom } from './dele.tsx';
import {
  detFaarDuFor,
  digTal,
  forhold,
  hvemGiverDig,
  mineKategorier,
  modparter,
  nemesis,
  skydeskive,
  type Forhold,
} from './statistik.ts';
import { useStat } from './StatistikData.tsx';

/** Opens one of Statistik's pushed pages, keeping the picked Sæson. */
export function useAabnSide() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  return (side: 'nemesis' | 'andre' | 'typer') => {
    const p = new URLSearchParams();
    const saeson = params.get('saeson');
    if (saeson) p.set('saeson', saeson);
    const q = p.toString();
    void navigate(`/statistik/${side}${q ? `?${q}` : ''}`);
  };
}

export function forholdTekst(f: Forhold): string {
  switch (f.art) {
    case 'ingen':
      return t('stat.forhold.ingen');
    case 'lige':
      return t('stat.forhold.lige');
    case 'kunGivet':
      return t('stat.forhold.kunGivet');
    case 'kunFaaet':
      return t('stat.forhold.kunFaaet');
    case 'giverFlere':
      return t('stat.forhold.giverFlere', { gange: decimal(f.gange) });
    case 'faarFlere':
      return t('stat.forhold.faarFlere', { gange: decimal(f.gange) });
  }
}

export const antalBoeder = (n: number) => (n === 1 ? t('stat.enBoede') : t('stat.boeder', { antal: n }));

/** The Dig segment: Fået / Givet, Nemesis and Skydeskive, and two simple bar cards. */
export function Dig() {
  const s = useStat();
  const aabn = useAabnSide();
  const tal = digTal(s.boeder, s.migId);
  const parter = modparter(s.boeder, s.medlemmer, s.migId);
  const nem = nemesis(parter);
  const skyd = skydeskive(parter);
  const giverDig = hvemGiverDig(parter).slice(0, 5);
  const kategorier = detFaarDuFor(mineKategorier(s.boeder, s.migId)).slice(0, 5);

  return (
    <>
      <div className="stat-to">
        <div className="stat-kort stat-tal">
          <span className="stat-tal__label">
            <span className="stat-prik stat-farve--guld" />
            {t('stat.faaet')}
          </span>
          <span className="stat-tal__antal">{tal.faaet.antal}</span>
          <span className="stat-tal__kr">{formatKr(tal.faaet.kr)}</span>
        </div>
        <div className="stat-kort stat-tal">
          <span className="stat-tal__label">
            <span className="stat-prik stat-farve--blaa" />
            {t('stat.givet')}
          </span>
          <span className="stat-tal__antal">{tal.givet.antal}</span>
          <span className="stat-tal__kr">{formatKr(tal.givet.kr)}</span>
        </div>
      </div>
      <div className="stat-kort stat-kort--taet">
        {(tal.givet.antal > 0 || tal.faaet.antal > 0) && (
          <div className="stat-split" aria-hidden="true">
            {tal.givet.antal > 0 && <span className="stat-farve--blaa" style={{ flex: tal.givet.antal }} />}
            {tal.faaet.antal > 0 && <span className="stat-farve--guld" style={{ flex: tal.faaet.antal }} />}
          </div>
        )}
        <span className="stat-dim">{forholdTekst(forhold(tal.givet.antal, tal.faaet.antal))}</span>
      </div>

      {(nem || skyd) && (
        <div className="stat-to">
          {nem ? (
            <button type="button" className="stat-kort stat-person stat-person--guld" onClick={() => aabn('nemesis')}>
              <span className="stat-person__rolle">
                <Skull size={14} strokeWidth={2} aria-hidden="true" />
                {t('stat.dinNemesis')}
              </span>
              <StatAvatar medlemId={nem.medlemId} size={52} />
              <span className="stat-person__navn">{s.navn(nem.medlemId)}</span>
              <span className="stat-person__under">{t('stat.tilDig', { antal: antalBoeder(nem.fik) })}</span>
            </button>
          ) : (
            <div className="stat-kort stat-person">
              <span className="stat-person__rolle stat-tekst--guld">
                <Skull size={14} strokeWidth={2} aria-hidden="true" />
                {t('stat.dinNemesis')}
              </span>
              <span className="stat-person__under">{t('stat.ingenNemesis')}</span>
            </div>
          )}
          {skyd ? (
            <button type="button" className="stat-kort stat-person stat-person--blaa" onClick={() => aabn('nemesis')}>
              <span className="stat-person__rolle">
                <Target size={14} strokeWidth={2} aria-hidden="true" />
                {t('stat.dinSkydeskive')}
              </span>
              <StatAvatar medlemId={skyd.medlemId} size={52} />
              <span className="stat-person__navn">{s.navn(skyd.medlemId)}</span>
              <span className="stat-person__under">{t('stat.fraDig', { antal: antalBoeder(skyd.gav) })}</span>
            </button>
          ) : (
            <div className="stat-kort stat-person">
              <span className="stat-person__rolle stat-tekst--blaa">
                <Target size={14} strokeWidth={2} aria-hidden="true" />
                {t('stat.dinSkydeskive')}
              </span>
              <span className="stat-person__under">{t('stat.ingenSkydeskive')}</span>
            </div>
          )}
        </div>
      )}

      <Kort onClick={() => aabn('andre')} className="stat-kort--liste">
        <KortTitel titel={t('stat.hvemGiverDig')} sammenlign />
        {giverDig.length === 0 ? (
          <Tom>{t('stat.ingenHarGivetDig')}</Tom>
        ) : (
          giverDig.map((p) => (
            <Bjaelke key={p.medlemId} label={s.navn(p.medlemId)} antal={p.fik} max={giverDig[0].fik} />
          ))
        )}
      </Kort>

      <Kort onClick={() => aabn('typer')} className="stat-kort--liste">
        <KortTitel titel={t('stat.detFaarDuFor')} sammenlign />
        {kategorier.length === 0 ? (
          <Tom>{t('stat.ingenHarGivetDig')}</Tom>
        ) : (
          kategorier.map((k) => (
            <Bjaelke
              key={k.kategoriId ?? ''}
              label={s.kategoriNavn(k.kategoriId)}
              antal={k.fik}
              max={kategorier[0].fik}
              bred
            />
          ))
        )}
      </Kort>
    </>
  );
}
