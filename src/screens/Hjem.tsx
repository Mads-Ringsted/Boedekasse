import { useState } from 'react';
import { ChevronDown, ChevronRight, Wallet } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useBodekasse } from '../bodekasse/BodekasseProvider.tsx';
import { SkiftBodekasseSheet } from '../bodekasse/SkiftBodekasseSheet.tsx';
import { Avatar } from '../components/Avatar.tsx';
import { Screen } from '../components/Screen.tsx';
import { useGivBoeder } from '../giv/GivBoederProvider.tsx';
import { useAabnProfil } from '../profil/aabnProfil.ts';
import { PauseKort } from '../saeson/PauseKort.tsx';
import { useSaeson } from '../saeson/SaesonProvider.tsx';
import { formatKr, t } from '../strings/index.ts';
import { useHent } from '../supabase/useHent.ts';
import { hentHjem } from './hjem/hentHjem.ts';
import { komIGang } from './hjem/komIGang.ts';
import { KomIGangKort } from './hjem/KomIGangKort.tsx';
import { Topliste } from './hjem/Topliste.tsx';
import { minStatus, opdelTopliste } from './hjem/topliste.ts';
import './hjem/Hjem.css';

/**
 * Hjem: header with the box switch, the box card, Indbetalt and I alt ikke
 * betalte bøder, what you owe (or Til gode), "Kom i gang" in a new box, and
 * the Topliste for the latest Sæson.
 */
export function Hjem() {
  const { bodekasseId, bodekasseNavn, medlemId, navn, erAdmin } = useBodekasse();
  const navigate = useNavigate();
  const aabnProfil = useAabnProfil('tab.hjem');
  const [skifter, setSkifter] = useState(false);
  const { version } = useGivBoeder();
  const { saeson, pause, version: saesonVersion } = useSaeson();
  const hjem = useHent(
    () => hentHjem(bodekasseId, medlemId, erAdmin),
    [bodekasseId, medlemId, erAdmin, version, saesonVersion],
  );
  const data = hjem.status === 'ready' ? hjem.data : null;
  const punkter = data && komIGang(data);
  // A new box (Kom i gang showing) has no money yet, so no money cards.
  const visPenge = data && !punkter ? data : null;
  const status = visPenge && minStatus(visPenge.minSaldo);
  const topliste = data && opdelTopliste(data.topliste);

  return (
    <Screen>
      <header className="hjem__header">
        <button type="button" className="hjem__skift" onClick={() => setSkifter(true)} aria-label={t('hjem.skift')}>
          <span className="hjem__label">{t('hjem.label')}</span>
          <span className="hjem__navn">
            {bodekasseNavn}
            <ChevronDown className="hjem__chevron" size={20} strokeWidth={2.4} aria-hidden="true" />
          </span>
        </button>
        <button
          type="button"
          className="hjem__avatar"
          aria-label={t('hjem.dinProfil')}
          onClick={() => aabnProfil(medlemId)}
        >
          <Avatar navn={navn} egen />
        </button>
      </header>

      <PauseKort />

      <button type="button" className="hjem__kasse" onClick={() => void navigate('/kassen')}>
        <span className="hjem__kasse-tekst">
          <span className="hjem__kasse-label">{t('hjem.iBoedekassen')}</span>
          <span className="hjem__kasse-beloeb">{data ? formatKr(data.iBoedekassen) : ' '}</span>
        </span>
        <ChevronRight className="hjem__kasse-chevron" size={22} strokeWidth={2} aria-hidden="true" />
      </button>

      {hjem.status === 'error' && (
        <button type="button" className="hjem__fejl" onClick={hjem.reload}>
          {t('fejl.ukendt')}
        </button>
      )}

      {visPenge && (
        <div className="hjem__tal">
          <div className="hjem__tal-kort">
            <span className="hjem__tal-label">{t('hjem.indbetalt')}</span>
            <span className="hjem__tal-beloeb hjem__tal-beloeb--ind">{formatKr(visPenge.indbetalt)}</span>
          </div>
          <div className="hjem__tal-kort">
            <span className="hjem__tal-label">{t('hjem.ikkeBetalt')}</span>
            <span className="hjem__tal-beloeb hjem__tal-beloeb--mangler">{formatKr(visPenge.ikkeBetalt)}</span>
          </div>
        </div>
      )}

      {status &&
        (status.art === 'tilGode' ? (
          <div className="hjem__min hjem__min--til-gode">
            <span className="hjem__min-tekst">
              <span className="hjem__min-label">{t('hjem.duHarTilGode')}</span>
              <span className="hjem__min-beloeb">{formatKr(status.beloeb)}</span>
            </span>
            <span className="hjem__min-note">{t('hjem.tilGodeTekst')}</span>
          </div>
        ) : (
          <div className="hjem__min">
            <span className="hjem__min-tekst">
              <span className="hjem__min-label">{t('hjem.duMangler')}</span>
              <span className="hjem__min-beloeb">{formatKr(status.beloeb)}</span>
            </span>
            {/* #60 opens the Betal sheet from here. */}
            {status.kanBetale && (
              <button type="button" className="hjem__betal">
                <Wallet size={20} strokeWidth={2} aria-hidden="true" />
                {t('hjem.betal')}
              </button>
            )}
          </div>
        ))}

      {data && punkter && <KomIGangKort punkter={punkter} bodekasseNavn={bodekasseNavn} kode={data.kode} />}

      {topliste && (
        <>
          <div className="hjem__sektion">
            <h2 className="hjem__sektion-titel">{t('hjem.topliste')}</h2>
            {!topliste.tom && (
              <span className="hjem__sektion-note">
                {pause && saeson ? t('hjem.boederIAltSaeson', { saeson: saeson.navn }) : t('hjem.boederIAlt')}
              </span>
            )}
          </div>
          {topliste.tom ? (
            <div className="hjem__tom">
              <span className="hjem__tom-titel">{t('hjem.toplisteTom')}</span>
              <span className="hjem__tom-tekst">{t('hjem.toplisteTomTekst')}</span>
            </div>
          ) : (
            <Topliste topliste={topliste} medlemId={medlemId} onVaelg={aabnProfil} />
          )}
        </>
      )}

      <SkiftBodekasseSheet open={skifter} onOpenChange={setSkifter} />
    </Screen>
  );
}
