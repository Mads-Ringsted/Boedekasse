import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useBodekasse } from '../bodekasse/BodekasseProvider.tsx';
import { SkiftBodekasseSheet } from '../bodekasse/SkiftBodekasseSheet.tsx';
import { Avatar } from '../components/Avatar.tsx';
import { Screen } from '../components/Screen.tsx';
import { formatKr, t } from '../strings/index.ts';
import { useHent } from '../supabase/useHent.ts';
import { hentHjem } from './hjem/hentHjem.ts';
import { komIGang } from './hjem/komIGang.ts';
import { KomIGangKort } from './hjem/KomIGangKort.tsx';
import './hjem/Hjem.css';

/**
 * Hjem: header with the box switch, the box card, "Kom i gang" in a new box,
 * and the Topliste. #53 adds the money cards and the real Topliste.
 */
export function Hjem() {
  const { bodekasseId, bodekasseNavn, navn, erAdmin } = useBodekasse();
  const [skifter, setSkifter] = useState(false);
  const hjem = useHent(() => hentHjem(bodekasseId, erAdmin), [bodekasseId, erAdmin]);
  const data = hjem.status === 'ready' ? hjem.data : null;
  const punkter = data && komIGang(data);

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
        {/* #55 makes this open your profile. */}
        <Avatar navn={navn} egen />
      </header>

      <div className="hjem__kasse">
        <span className="hjem__kasse-label">{t('hjem.iBoedekassen')}</span>
        <span className="hjem__kasse-beloeb">{data ? formatKr(data.iBoedekassen) : ' '}</span>
      </div>

      {hjem.status === 'error' && (
        <button type="button" className="hjem__fejl" onClick={hjem.reload}>
          {t('fejl.ukendt')}
        </button>
      )}

      {data && punkter && <KomIGangKort punkter={punkter} bodekasseNavn={bodekasseNavn} kode={data.kode} />}

      {data && (
        <>
          <h2 className="hjem__sektion">{t('hjem.topliste')}</h2>
          {data.antalBoeder === 0 ? (
            <div className="hjem__tom">
              <span className="hjem__tom-titel">{t('hjem.toplisteTom')}</span>
              <span className="hjem__tom-tekst">{t('hjem.toplisteTomTekst')}</span>
            </div>
          ) : (
            <p className="screen__placeholder">{t('skaerm.kommerSnart')}</p>
          )}
        </>
      )}

      <SkiftBodekasseSheet open={skifter} onOpenChange={setSkifter} />
    </Screen>
  );
}
