import { CircleAlert, CircleCheck } from 'lucide-react';
import { t } from '../strings/index.ts';
import type { EmailLink } from './emailLink.ts';
import './InstallGuide.css';

/**
 * Shown in a Safari tab opened by a Supabase email link. The session
 * stays in Safari, so the person goes back to the app and uses a code.
 */
export function EmailBekraeftet({ link }: { link: Exclude<EmailLink, null> }) {
  const ok = link === 'bekraeftet';
  const Icon = ok ? CircleCheck : CircleAlert;
  return (
    <main className="install">
      <span className="install__badged">
        <img className="install__icon" src="/app-icon.svg" width={84} height={84} alt="" />
        <Icon
          className={`install__badge ${ok ? 'install__badge--ok' : 'install__badge--fejl'}`}
          size={32}
          strokeWidth={2.4}
          aria-hidden="true"
        />
      </span>
      <h1 className="install__title install__title--status">
        {t(ok ? 'emailLink.bekraeftetTitel' : 'emailLink.fejlTitel')}
      </h1>
      <p className="install__intro">
        {t(ok ? 'emailLink.bekraeftetTekst' : 'emailLink.fejlTekst', { app: t('app.navn') })}
      </p>
    </main>
  );
}
