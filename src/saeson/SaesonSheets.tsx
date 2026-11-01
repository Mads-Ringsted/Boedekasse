import { useState, type FormEvent } from 'react';
import { useBodekasse } from '../bodekasse/BodekasseProvider.tsx';
import { Field } from '../components/Field.tsx';
import { primaryAction, typedRequirement, visibleError } from '../components/field.ts';
import { Sheet } from '../components/Sheet.tsx';
import { SheetAction } from '../components/SheetAction.tsx';
import { t } from '../strings/index.ts';
import { supabase } from '../supabase/index.ts';
import { rpcErrorText } from '../supabase/rpcErrors.ts';
import { iDagIKoebenhavn, tjekSlutdato } from './saeson.ts';
import { useSaeson } from './SaesonProvider.tsx';
import '../medlemmer/felter.css';
import './Saeson.css';

const SLUTDATO_FORM = 'slutdato';

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Runs one Sæson RPC with a one-time ID per opening; a "Prøv igen" after a
 * lost answer reuses it. On success it closes the sheet and tells
 * `useSaeson()` (and everything keyed on its `version`) to reload.
 */
function useSaesonKald(onOpenChange: (open: boolean) => void) {
  const { aendret } = useSaeson();
  const [busy, setBusy] = useState(false);
  const [fejl, setFejl] = useState<string | null>(null);
  const [klientId, setKlientId] = useState(() => crypto.randomUUID());

  function skift(aaben: boolean) {
    if (!aaben) {
      setFejl(null);
      setKlientId(crypto.randomUUID());
    }
    onOpenChange(aaben);
  }

  async function kald(rpc: (klientId: string) => PromiseLike<{ error: unknown }>) {
    setBusy(true);
    setFejl(null);
    const { error } = await rpc(klientId);
    setBusy(false);
    if (error) {
      setFejl(rpcErrorText(error));
      return;
    }
    skift(false);
    aendret();
  }

  return { busy, fejl, skift, kald };
}

function Fejl({ fejl }: { fejl: string | null }) {
  return fejl ? (
    <p className="felt-fejl" role="alert">
      {fejl}
    </p>
  ) : null;
}

/** "Start ny sæson?" (Admin): ends a running Sæson and starts the next. No undo. */
export function StartSaesonSheet({ open, onOpenChange }: SheetProps) {
  const { bodekasseId } = useBodekasse();
  const { saeson, pause } = useSaeson();
  const { busy, fejl, skift, kald } = useSaesonKald(onOpenChange);
  const tekst =
    pause || !saeson ? t('saeson.startTekstPause') : t('saeson.startTekst', { saeson: saeson.navn });

  return (
    <Sheet
      open={open}
      onOpenChange={skift}
      height="partial"
      title={t('saeson.startTitel')}
      footer={
        <button
          type="button"
          className="felt-knap"
          disabled={busy}
          onClick={() =>
            void kald((id) => supabase.rpc('start_saeson', { p_klient_id: id, p_bodekasse: bodekasseId }))
          }
        >
          {t('saeson.start')}
        </button>
      }
    >
      <p className="felt-note">{tekst}</p>
      <Fejl fejl={fejl} />
    </Sheet>
  );
}

/** "Afslut sæsonen nu?" (Admin): ends the running Sæson at once; the box is in Pause. */
export function AfslutSaesonSheet({ open, onOpenChange }: SheetProps) {
  const { bodekasseId } = useBodekasse();
  const { saeson } = useSaeson();
  const { busy, fejl, skift, kald } = useSaesonKald(onOpenChange);

  return (
    <Sheet
      open={open}
      onOpenChange={skift}
      height="partial"
      title={t('saeson.afslutTitel')}
      footer={
        <button
          type="button"
          className="felt-knap felt-knap--fare"
          disabled={busy}
          onClick={() =>
            void kald((id) => supabase.rpc('afslut_saeson', { p_klient_id: id, p_bodekasse: bodekasseId }))
          }
        >
          {t('saeson.afslutKnap')}
        </button>
      }
    >
      <p className="felt-note">{t('saeson.afslutTekst', { saeson: saeson?.navn ?? '' })}</p>
      <Fejl fejl={fejl} />
    </Sheet>
  );
}

/** The end date (Admin): pick the last day, or remove it. Mount with a new `key` per opening. */
export function SlutdatoSheet({ open, onOpenChange }: SheetProps) {
  const { bodekasseId } = useBodekasse();
  const { saeson } = useSaeson();
  const { busy, fejl, skift, kald } = useSaesonKald(onOpenChange);
  const start = saeson?.slutdato ?? '';
  const [dato, setDato] = useState(start);
  const resultat = tjekSlutdato(dato);
  const handling = primaryAction(
    [typedRequirement(dato, resultat.ok, t('aarsag.vaelgDato'), t('aarsag.retDato'))],
    { busy, unchanged: dato === start },
  );

  const gem = (slutdato: string | null) =>
    kald((id) =>
      // The generated type says `string`, but the RPC takes null to remove the date.
      supabase.rpc('saet_slutdato', { p_klient_id: id, p_bodekasse: bodekasseId, p_slutdato: slutdato as string }),
    );

  function submit(event: FormEvent) {
    event.preventDefault();
    if (resultat.ok && handling.enabled) void gem(resultat.vaerdi);
  }

  return (
    <Sheet
      open={open}
      onOpenChange={skift}
      height="partial"
      title={t('saeson.slutdatoTitel')}
      dirty={dato !== start}
      footer={
        <>
          <SheetAction form={SLUTDATO_FORM} disabled={!handling.enabled} reason={handling.reason} error={fejl}>
            {t('indstillinger.gem')}
          </SheetAction>
          {start !== '' && (
            <button type="button" className="saeson-fjern" disabled={busy} onClick={() => void gem(null)}>
              {t('saeson.fjernSlutdato')}
            </button>
          )}
        </>
      }
    >
      <form id={SLUTDATO_FORM} onSubmit={submit}>
        <Field
          label={t('saeson.slutdatoLabel')}
          kind="date"
          min={iDagIKoebenhavn()}
          value={dato}
          onChange={setDato}
          error={visibleError(dato, resultat.ok ? null : resultat.fejl)}
          note={t('saeson.slutdatoNote')}
        />
      </form>
    </Sheet>
  );
}
