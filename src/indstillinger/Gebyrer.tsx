import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { useBodekasse } from '../bodekasse/BodekasseProvider.tsx';
import { BackButton } from '../components/BackButton.tsx';
import { Screen } from '../components/Screen.tsx';
import { formatKr, t } from '../strings/index.ts';
import { rpcErrorText } from '../supabase/rpcErrors.ts';
import type { IndstillingAendringer, Indstillinger as IndstillingerData } from './indstillinger.ts';
import { Gruppe, LinkRaekke, SwitchRaekke } from './raekker.tsx';
import { tjekAntal, tjekBeloeb, tjekBetalingsdag, tjekLoft } from './regler.ts';
import { RetIndstillingSheet, type RetIndhold } from './RetIndstillingSheet.tsx';
import { TilbagevendendeGruppe } from './TilbagevendendeGruppe.tsx';
import { useIndstillinger } from './useIndstillinger.ts';
import './Indstillinger.css';

/** Settings that are a whole-krone amount above 0. */
type BeloebNoegle = {
  [K in keyof IndstillingerData]: IndstillingerData[K] extends number ? K : never;
}[keyof IndstillingerData];

type SheetIndhold = RetIndhold<unknown>;

/**
 * Indstillinger → Gebyrer (Admin only). A stand-in from #94 that keeps
 * today's Gebyr rows reachable once the hub dropped Særlige regler. #95
 * replaces it with the grouped page built from `RegelRaekke` and `RegelSheet`.
 */
export function Gebyrer() {
  const { erAdmin } = useBodekasse();
  if (!erAdmin) return <Navigate to="/mere" replace />;
  return <GebyrerSkaerm />;
}

function GebyrerSkaerm() {
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
      <BackButton label={t('mere.indstillinger')} onClick={() => void navigate('/indstillinger')} />
      <h1 className="screen__title">{t('indstillinger.gebyrer')}</h1>

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
        <Gruppe>
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
          <SwitchRaekke
            label={t('indstillinger.dosBonus')}
            under={formatKr(ind.dos_bonus_beloeb)}
            til={ind.dos_bonus_til}
            onSkift={(til) => skift({ dos_bonus_til: til })}
            onAabn={() => retBeloeb('dos_bonus_beloeb', t('indstillinger.dosBonus'), t('indstillinger.dosBonusNote'))}
          />
          <SwitchRaekke
            label={t('indstillinger.catchUp')}
            under={t('indstillinger.catchUpUnder', {
              antal: ind.catch_up_antal,
              beloeb: formatKr(ind.catch_up_beloeb),
            })}
            til={ind.catch_up_til}
            onSkift={(til) => skift({ catch_up_til: til })}
            onAabn={() => retBeloeb('catch_up_beloeb', t('indstillinger.catchUp'), t('indstillinger.catchUpNote'))}
          />
          <LinkRaekke
            label={t('indstillinger.catchUpAntal')}
            vaerdi={String(ind.catch_up_antal)}
            onClick={() =>
              aabn<number>({
                title: t('indstillinger.catchUpAntal'),
                label: t('indstillinger.catchUpAntalLabel'),
                start: String(ind.catch_up_antal),
                inputMode: 'numeric',
                note: t('indstillinger.catchUpAntalNote'),
                tjek: tjekAntal,
                onGem: (catch_up_antal, klientId) => gem({ catch_up_antal }, klientId),
              })
            }
          />
          <SwitchRaekke
            label={t('indstillinger.senBetaling')}
            under={
              ind.sen_betaling_loft === null
                ? t('indstillinger.senBetalingUnder', {
                    beloeb: formatKr(ind.sen_betaling_beloeb),
                    dag: ind.betalingsdag,
                  })
                : t('indstillinger.senBetalingUnderLoft', {
                    beloeb: formatKr(ind.sen_betaling_beloeb),
                    dag: ind.betalingsdag,
                    loft: formatKr(ind.sen_betaling_loft),
                  })
            }
            til={ind.sen_betaling_til}
            onSkift={(til) => skift({ sen_betaling_til: til })}
            onAabn={() =>
              retBeloeb('sen_betaling_beloeb', t('indstillinger.senBetaling'), t('indstillinger.senBetalingNote'))
            }
          />
          <LinkRaekke
            label={t('indstillinger.betalingsdag')}
            vaerdi={t('indstillinger.betalingsdagVaerdi', { dag: ind.betalingsdag })}
            onClick={() =>
              aabn<number>({
                title: t('indstillinger.betalingsdag'),
                label: t('indstillinger.betalingsdagLabel'),
                start: String(ind.betalingsdag),
                inputMode: 'numeric',
                note: t('indstillinger.betalingsdagNote'),
                tjek: tjekBetalingsdag,
                onGem: (betalingsdag, klientId) => gem({ betalingsdag }, klientId),
              })
            }
          />
          <LinkRaekke
            label={t('indstillinger.senBetalingLoft')}
            vaerdi={
              ind.sen_betaling_loft === null ? t('indstillinger.senBetalingLoftIngen') : formatKr(ind.sen_betaling_loft)
            }
            onClick={() =>
              aabn<number | null>({
                title: t('indstillinger.senBetalingLoft'),
                label: t('indstillinger.beloeb'),
                start: ind.sen_betaling_loft === null ? '' : String(ind.sen_betaling_loft),
                enhed: t('kategori.kr'),
                inputMode: 'numeric',
                note: t('indstillinger.senBetalingLoftNote'),
                tjek: tjekLoft,
                onGem: (sen_betaling_loft, klientId) => gem({ sen_betaling_loft }, klientId),
              })
            }
          />
        </Gruppe>
      )}

      <TilbagevendendeGruppe />

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
