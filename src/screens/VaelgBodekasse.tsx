import { BodekasseListe, KasseValg } from '../bodekasse/BodekasseListe.tsx';
import { useMedlemskaber } from '../bodekasse/BodekasseProvider.tsx';
import { t } from '../strings/index.ts';
import './VaelgBodekasse.css';

/** In several boxes, none used on this device yet: pick one. */
export function VaelgBodekasse() {
  const { load, switchTo } = useMedlemskaber();
  const medlemskaber = load.status === 'ready' ? load.medlemskaber : [];

  return (
    <main className="vaelg">
      <h1 className="vaelg__title">{t('vaelg.titel')}</h1>
      <BodekasseListe medlemskaber={medlemskaber} onVaelg={switchTo} />
      <div className="vaelg__bund">
        <KasseValg />
      </div>
    </main>
  );
}
