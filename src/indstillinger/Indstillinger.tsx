import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { useBodekasse } from '../bodekasse/BodekasseProvider.tsx';
import { BackButton } from '../components/BackButton.tsx';
import { Screen } from '../components/Screen.tsx';
import { SaesonRaekker } from '../saeson/SaesonRaekker.tsx';
import { parsePris } from '../kategorier/kategoriListe.ts';
import { formatKr, t } from '../strings/index.ts';
import { rpcErrorText } from '../supabase/rpcErrors.ts';
import { rensMobilePay, type IndstillingAendringer, type Indstillinger as IndstillingerData } from './indstillinger.ts';
import { Gruppe, LinkRaekke, SwitchRaekke } from './raekker.tsx';
import { RetIndstillingSheet, type RetIndhold, type Tjek } from './RetIndstillingSheet.tsx';
import { useIndstillinger } from './useIndstillinger.ts';
import './Indstillinger.css';

/** Settings that are a whole-krone amount above 0. */
type BeloebNoegle = {
  [K in keyof IndstillingerData]: IndstillingerData[K] extends number ? K : never;
}[keyof IndstillingerData];

type SheetIndhold = RetIndhold<unknown>;

const tjekNavn: Tjek<string> = (tekst) =>
  tekst.trim() === '' ? { ok: false, fejl: t('fejl.navnMangler') } : { ok: true, vaerdi: tekst.trim() };

const tjekMobilePay: Tjek<string | null> = (tekst) => {
  const r = rensMobilePay(tekst);
  return r.ok ? r : { ok: false, fejl: t('fejl.mobilepayUgyldig') };
};

const tjekBeloeb: Tjek<number> = (tekst) => {
  const beloeb = parsePris(tekst);
  return beloeb === null ? { ok: false, fejl: t('indstillinger.beloebUgyldig') } : { ok: true, vaerdi: beloeb };
};

/**
 * Indstillinger (Admin only): the box's name and MobilePay Box number, the
 * Særlige regler and Sæson og data. Every change goes through
 * `useIndstillinger().gem` (the `opdater_indstillinger` RPC).
 *
 * Adding a rule (later tickets): add its columns to `private.indstilling` in
 * your migration, then a row below. A switch with an amount is a
 * `<SwitchRaekke>` whose `onAabn` is `retBeloeb(...)`.
 */
export function Indstillinger() {
  const { erAdmin } = useBodekasse();
  if (!erAdmin) return <Navigate to="/mere" replace />;
  return <IndstillingerSkaerm />;
}

function IndstillingerSkaerm() {
  const navigate = useNavigate();
  const { status, error, reload, indstillinger: ind, gem } = useIndstillinger();
  const [fejl, setFejl] = useState<string | null>(null);
  const [sheet, setSheet] = useState<{ n: number; open: boolean; indhold: SheetIndhold } | null>(null);

  function aabn<V>(indhold: RetIndhold<V>) {
    setSheet((s) => ({ n: (s?.n ?? 0) + 1, open: true, indhold: indhold as unknown as SheetIndhold }));
  }

  /** A switch flips at once; a refusal flips it back and shows why. */
  function skift(aendringer: IndstillingAendringer) {
    setFejl(null);
    gem(aendringer).catch((e: unknown) => setFejl(rpcErrorText(e)));
  }

  function retBeloeb(noegle: BeloebNoegle, title: string, note?: string) {
    if (!ind) return;
    aabn<number>({
      title,
      label: t('indstillinger.beloeb'),
      start: String(ind[noegle]),
      enhed: t('kategori.kr'),
      inputMode: 'numeric',
      note,
      tjek: tjekBeloeb,
      onGem: (beloeb, klientId) => gem({ [noegle]: beloeb }, klientId),
    });
  }

  return (
    <Screen>
      <BackButton label={t('tab.mere')} onClick={() => void navigate('/mere')} />
      <h1 className="screen__title">{t('mere.indstillinger')}</h1>

      {status === 'error' && (
        <button type="button" className="indst__fejl" onClick={reload}>
          {rpcErrorText(error)} · {t('handling.proevIgen')}
        </button>
      )}
      {fejl && (
        <p className="indst__fejl" role="alert">
          {fejl}
        </p>
      )}

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
                  inputMode: 'numeric',
                  note: t('indstillinger.mobilepayNote'),
                  tjek: tjekMobilePay,
                  onGem: (mobilepay_box, klientId) => gem({ mobilepay_box }, klientId),
                })
              }
            />
          </Gruppe>

          <Gruppe titel={t('indstillinger.saerligeRegler')}>
            <SwitchRaekke
              label={t('indstillinger.oprettelsesgebyr')}
              under={formatKr(ind.oprettelsesgebyr)}
              til={ind.oprettelsesgebyr_til}
              onSkift={(til) => skift({ oprettelsesgebyr_til: til })}
              onAabn={() =>
                retBeloeb('oprettelsesgebyr', t('indstillinger.oprettelsesgebyr'), t('indstillinger.oprettelsesgebyrNote'))
              }
            />
            <SwitchRaekke
              label={t('indstillinger.engangsgebyr')}
              under={formatKr(ind.engangsgebyr)}
              til={ind.engangsgebyr_til}
              onSkift={(til) => skift({ engangsgebyr_til: til })}
              onAabn={() =>
                retBeloeb('engangsgebyr', t('indstillinger.engangsgebyr'), t('indstillinger.engangsgebyrNote'))
              }
            />
            {/* #66 Anke, #65 Frikøb, #67 Konkurrencegebyrer go here. */}
          </Gruppe>

          <Gruppe titel={t('indstillinger.saesonOgData')}>
            <SaesonRaekker />
            {/* #70 Eksportér data goes here. */}
          </Gruppe>

          {/* #71 Slet Bødekasse: its own <Gruppe> with an art="fare" row. */}
        </>
      )}

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
