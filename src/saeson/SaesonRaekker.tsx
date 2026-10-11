import { useState } from 'react';
import { useBodekasse } from '../bodekasse/BodekasseProvider.tsx';
import { LinkRaekke } from '../indstillinger/raekker.tsx';
import { RetIndstillingSheet, type Tjek } from '../indstillinger/RetIndstillingSheet.tsx';
import { t } from '../strings/index.ts';
import { supabase } from '../supabase/index.ts';
import { slutdatoTekst } from './saeson.ts';
import { AfslutSaesonSheet, SlutdatoSheet, StartSaesonSheet } from './SaesonSheets.tsx';
import { useSaeson } from './SaesonProvider.tsx';

type Aaben = 'slutdato' | 'navn' | 'start' | 'afslut';

const tjekNavn: Tjek<string> = (tekst) =>
  tekst.trim() === '' ? { ok: false, fejl: t('fejl.navnMangler') } : { ok: true, vaerdi: tekst.trim() };

/**
 * Indstillinger → Sæson og data (Admin): the end date, the Sæson's name,
 * Start ny sæson and Afslut sæson nu. In a Pause only the name and Start.
 */
export function SaesonRaekker() {
  const { bodekasseId } = useBodekasse();
  const { saeson, pause, aendret } = useSaeson();
  const [aaben, setAaben] = useState<{ hvad: Aaben; n: number } | null>(null);
  if (!saeson) return null;

  const aabn = (hvad: Aaben) => setAaben((a) => ({ hvad, n: (a?.n ?? 0) + 1 }));
  const luk = (open: boolean) => {
    if (!open) setAaben(null);
  };

  async function omdoeb(navn: string, klientId: string) {
    const { error } = await supabase.rpc('omdoeb_saeson', {
      p_klient_id: klientId,
      p_bodekasse: bodekasseId,
      p_navn: navn,
    });
    if (error) throw error;
    aendret();
  }

  return (
    <>
      {!pause && (
        <LinkRaekke
          label={t('saeson.slutter', { saeson: saeson.navn })}
          vaerdi={slutdatoTekst(saeson.slutdato)}
          onClick={() => aabn('slutdato')}
        />
      )}
      <LinkRaekke label={t('saeson.navn')} vaerdi={saeson.navn} onClick={() => aabn('navn')} />
      <LinkRaekke label={t('saeson.start')} art="handling" onClick={() => aabn('start')} />
      {!pause && <LinkRaekke label={t('saeson.afslut')} art="handling" onClick={() => aabn('afslut')} />}

      {aaben?.hvad === 'slutdato' && <SlutdatoSheet key={aaben.n} open onOpenChange={luk} />}
      {aaben?.hvad === 'navn' && (
        <RetIndstillingSheet
          key={aaben.n}
          open
          onOpenChange={luk}
          title={t('saeson.navnTitel')}
          label={t('saeson.navn')}
          start={saeson.navn}
          tjek={tjekNavn}
          onGem={omdoeb}
        />
      )}
      <StartSaesonSheet open={aaben?.hvad === 'start'} onOpenChange={luk} />
      <AfslutSaesonSheet open={aaben?.hvad === 'afslut'} onOpenChange={luk} />
    </>
  );
}
