import { ArrowDown, Share, SquarePlus } from 'lucide-react';
import { T } from '../components/T.tsx';
import { t } from '../strings/index.ts';
import './InstallGuide.css';

/** The only screen a browser tab shows: how to add the app to the home screen. */
export function InstallGuide() {
  return (
    <main className="install">
      <img className="install__icon" src="/app-icon.svg" width={84} height={84} alt="" />
      <h1 className="install__title">{t('app.navn')}</h1>
      <p className="install__intro">{t('installer.intro')}</p>

      <ol className="install__steps">
        <li className="install__step">
          <span className="install__num">1</span>
          <span className="install__text">
            <T id="installer.trin1" values={{ del: <strong>{t('installer.del')}</strong> }} />
          </span>
          <span className="install__hint" aria-hidden="true">
            <Share size={18} />
          </span>
        </li>
        <li className="install__step">
          <span className="install__num">2</span>
          <span className="install__text">
            <T
              id="installer.trin2"
              values={{ foej: <strong>{t('installer.foejTilHjemmeskaerm')}</strong> }}
            />
          </span>
          <span className="install__hint" aria-hidden="true">
            <SquarePlus size={18} />
          </span>
        </li>
        <li className="install__step">
          <span className="install__num">3</span>
          <span className="install__text">
            <T id="installer.trin3" values={{ app: <strong>{t('app.navn')}</strong> }} />
          </span>
        </li>
      </ol>

      <p className="install__req">{t('installer.krav')}</p>

      <p className="install__pointer">
        {t('installer.delKnappen')}
        <ArrowDown size={22} strokeWidth={2.2} aria-hidden="true" />
      </p>
    </main>
  );
}
