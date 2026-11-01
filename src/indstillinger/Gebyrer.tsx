import { useNavigate } from 'react-router';
import { BackButton } from '../components/BackButton.tsx';
import { Screen } from '../components/Screen.tsx';
import { t } from '../strings/index.ts';
import { GEBYRER_AUTOMATISKE, GEBYRER_NAAR_NOGEN } from './gebyrer.ts';
import { KunAdmin, useIndstillingerSide } from './IndstillingerSide.tsx';
import { Gruppe, LinkRaekke } from './raekker.tsx';
import { TilbagevendendeGruppe } from './TilbagevendendeGruppe.tsx';
import './Indstillinger.css';

/**
 * Indstillinger → Gebyrer (#95, Admin only): every Gebyr in three groups.
 * "Når nogen gør noget" and "Automatiske" are rule rows (see `gebyrer.ts`);
 * "Tilbagevendende" is the running list with "+ Nyt".
 */
export function Gebyrer() {
  return (
    <KunAdmin>
      <GebyrerSkaerm />
    </KunAdmin>
  );
}

function GebyrerSkaerm() {
  const navigate = useNavigate();
  const { indstillinger: ind, fejl, aabnRegel, regelSheet } = useIndstillingerSide();

  return (
    <Screen>
      <BackButton label={t('mere.indstillinger')} onClick={() => void navigate('/indstillinger')} />
      <h1 className="screen__title">{t('indstillinger.gebyrer')}</h1>
      {fejl}

      {ind && (
        <>
          <Gruppe titel={t('indstillinger.gebyrerNaarNogen')}>
            {GEBYRER_NAAR_NOGEN.map((regel) => (
              <LinkRaekke
                key={regel.id}
                label={regel.titel}
                status={regel.status(ind)}
                onClick={() => aabnRegel(regel)}
              />
            ))}
          </Gruppe>
          <Gruppe titel={t('indstillinger.gebyrerAutomatiske')}>
            {GEBYRER_AUTOMATISKE.map((regel) => (
              <LinkRaekke
                key={regel.id}
                label={regel.titel}
                status={regel.status(ind)}
                onClick={() => aabnRegel(regel)}
              />
            ))}
          </Gruppe>
        </>
      )}

      <TilbagevendendeGruppe />
      {regelSheet}
    </Screen>
  );
}
