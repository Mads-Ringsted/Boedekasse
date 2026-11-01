import { useState } from 'react';
import { useNavigate } from 'react-router';
import { BackButton } from '../components/BackButton.tsx';
import { Screen } from '../components/Screen.tsx';
import { EksportSheet } from '../eksport/EksportSheet.tsx';
import { SaesonRaekker } from '../saeson/SaesonRaekker.tsx';
import { FRA_INDSTILLINGER } from '../screens/Medlemmer.tsx';
import { SletBodekasseSheet } from '../slet/SletBodekasseSheet.tsx';
import { t } from '../strings/index.ts';
import { gebyrerStatus } from './gebyrer.ts';
import { rensMobilePay } from './indstillinger.ts';
import { KunAdmin, useIndstillingerSide } from './IndstillingerSide.tsx';
import { Gruppe, LinkRaekke } from './raekker.tsx';
import { REGLER } from './regler.ts';
import { RetIndstillingSheet, type RetIndhold, type Tjek } from './RetIndstillingSheet.tsx';
import './Indstillinger.css';

type SheetIndhold = RetIndhold<unknown>;

const tjekNavn: Tjek<string> = (tekst) =>
  tekst.trim() === '' ? { ok: false, fejl: t('fejl.navnMangler') } : { ok: true, vaerdi: tekst.trim() };

const tjekMobilePay: Tjek<string | null> = (tekst) => {
  const renset = rensMobilePay(tekst);
  return renset.ok ? renset : { ok: false, fejl: t('fejl.mobilepayUgyldig') };
};

/**
 * Indstillinger (Admin only): a short hub (#94). Bødekasse, Regler, Gebyrer,
 * Sæson, Data and Slet Bødekasse. Every change goes through
 * `useIndstillinger().gem` (the `opdater_indstillinger` RPC).
 *
 * Adding a rule: write a `Regel` with a status helper in `regler.ts` and add
 * it to `REGLER`, or to a group in `gebyrer.ts` for the Gebyrer page. Its
 * row and sheet come for free.
 */
export function Indstillinger() {
  return (
    <KunAdmin>
      <IndstillingerSkaerm />
    </KunAdmin>
  );
}

function IndstillingerSkaerm() {
  const navigate = useNavigate();
  const { indstillinger: ind, gem, fejl, aabnRegel, regelSheet } = useIndstillingerSide();
  const [sheet, setSheet] = useState<{ n: number; open: boolean; indhold: SheetIndhold } | null>(null);
  const [eksport, setEksport] = useState<{ n: number; open: boolean } | null>(null);
  // Slet Bødekasse: each opening mounts a fresh sheet (new one-time ID).
  const [sletter, setSletter] = useState(0);

  function aabnEksport() {
    setEksport((e) => ({ n: (e?.n ?? 0) + 1, open: true }));
  }

  function aabn<V>(indhold: RetIndhold<V>) {
    setSheet((s) => ({ n: (s?.n ?? 0) + 1, open: true, indhold: indhold as unknown as SheetIndhold }));
  }

  return (
    <Screen>
      <BackButton label={t('tab.mere')} onClick={() => void navigate('/mere')} />
      <h1 className="screen__title">{t('mere.indstillinger')}</h1>
      {fejl}

      {ind && (
        <>
          <Gruppe titel={t('indstillinger.bodekasse')}>
            <LinkRaekke
              label={t('indstillinger.navn')}
              vaerdi={ind.navn}
              onClick={() =>
                aabn<string>({
                  title: t('indstillinger.navnTitel'),
                  label: t('indstillinger.navn'),
                  start: ind.navn,
                  tjek: tjekNavn,
                  onGem: (navn, klientId) => gem({ navn }, klientId),
                })
              }
            />
            <LinkRaekke
              label={t('indstillinger.mobilepay')}
              vaerdi={ind.mobilepay_box ?? t('indstillinger.mobilepayIngen')}
              onClick={() =>
                aabn<string | null>({
                  title: t('indstillinger.mobilepay'),
                  label: t('indstillinger.mobilepayLabel'),
                  start: ind.mobilepay_box ?? '',
                  kind: 'integer',
                  note: t('indstillinger.mobilepayNote'),
                  tjek: tjekMobilePay,
                  onGem: (mobilepay_box, klientId) => gem({ mobilepay_box }, klientId),
                })
              }
            />
            <LinkRaekke
              label={t('indstillinger.medlemmerOgRoller')}
              onClick={() => void navigate('/medlemmer', { state: FRA_INDSTILLINGER })}
            />
          </Gruppe>

          <Gruppe titel={t('indstillinger.regler')}>
            {REGLER.map((regel) => (
              <LinkRaekke
                key={regel.id}
                label={regel.titel}
                status={regel.status(ind)}
                onClick={() => aabnRegel(regel)}
              />
            ))}
          </Gruppe>

          <Gruppe>
            <LinkRaekke
              label={t('indstillinger.gebyrer')}
              status={gebyrerStatus(ind)}
              onClick={() => void navigate('/indstillinger/gebyrer')}
            />
          </Gruppe>

          <Gruppe titel={t('indstillinger.saeson')}>
            <SaesonRaekker />
          </Gruppe>

          <Gruppe titel={t('indstillinger.data')}>
            <LinkRaekke label={t('eksport.raekke')} art="handling" onClick={aabnEksport} />
          </Gruppe>

          <Gruppe>
            <LinkRaekke art="fare" label={t('sletKasse.raekke')} onClick={() => setSletter((n) => n + 1)} />
          </Gruppe>
        </>
      )}

      {sletter > 0 && (
        <SletBodekasseSheet
          key={sletter}
          open
          onOpenChange={(aaben) => !aaben && setSletter(0)}
          onEksporter={() => {
            setSletter(0);
            aabnEksport();
          }}
        />
      )}
      {eksport && (
        <EksportSheet
          key={eksport.n}
          open={eksport.open}
          onOpenChange={(open) => setEksport((e) => e && { ...e, open })}
        />
      )}

      {regelSheet}

      {sheet && (
        <RetIndstillingSheet
          key={sheet.n}
          open={sheet.open}
          onOpenChange={(open) => setSheet((s) => s && { ...s, open })}
          {...sheet.indhold}
        />
      )}
    </Screen>
  );
}
