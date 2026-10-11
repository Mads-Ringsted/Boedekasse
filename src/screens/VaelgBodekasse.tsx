import { useMedlemskaber } from '../bodekasse/BodekasseProvider.tsx';
import { t } from '../strings/index.ts';
import './VaelgBodekasse.css';

/**
 * In several boxes, none used on this device yet. Minimal stand-in so the
 * app is usable; #50 builds the real screen (mocks/vaelg-boedekasse.html).
 */
export function VaelgBodekasse() {
  const { load, switchTo } = useMedlemskaber();
  const medlemskaber = load.status === 'ready' ? load.medlemskaber : [];

  return (
    <main className="vaelg">
      <h1 className="vaelg__title">{t('vaelg.titel')}</h1>
      <ul className="vaelg__list">
        {medlemskaber.map((m) => (
          <li key={m.bodekasseId}>
            <button type="button" className="vaelg__row" onClick={() => switchTo(m.bodekasseId)}>
              {m.bodekasseNavn}
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
