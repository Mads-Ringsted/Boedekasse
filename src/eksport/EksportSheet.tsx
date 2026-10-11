import { useState } from 'react';
import { useBodekasse } from '../bodekasse/BodekasseProvider.tsx';
import { Sheet } from '../components/Sheet.tsx';
import { LinkRaekke } from '../indstillinger/raekker.tsx';
import { t } from '../strings/index.ts';
import { rpcErrorText } from '../supabase/rpcErrors.ts';
import { useHent } from '../supabase/useHent.ts';
import { eksportCsv, eksportFilnavn } from './eksport.ts';
import { gemFil, hentEksport, hentSaesoner } from './hentEksport.ts';
import '../medlemmer/felter.css';
import '../indstillinger/Indstillinger.css';
import './Eksport.css';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Indstillinger → Eksportér data (Admin): pick a Sæson and get its CSV with
 * every Bøde, Gebyr, Indbetaling and Hævning.
 */
export function EksportSheet({ open, onOpenChange }: Props) {
  const { bodekasseId, bodekasseNavn } = useBodekasse();
  const saesoner = useHent(() => hentSaesoner(bodekasseId), [bodekasseId]);
  const [henter, setHenter] = useState<string | null>(null);
  const [fejl, setFejl] = useState<string | null>(null);

  async function eksporter(id: string, navn: string) {
    setHenter(id);
    setFejl(null);
    try {
      const raekker = await hentEksport(bodekasseId, id);
      await gemFil(eksportFilnavn(bodekasseNavn, navn), eksportCsv(raekker));
    } catch (e) {
      setFejl(rpcErrorText(e));
    } finally {
      setHenter(null);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange} height="partial" title={t('eksport.titel')}>
      <p className="felt-note eksport__tekst">{t('eksport.tekst')}</p>
      {saesoner.status === 'error' && (
        <button type="button" className="felt-fejl" onClick={saesoner.reload}>
          {rpcErrorText(saesoner.error)} · {t('handling.proevIgen')}
        </button>
      )}
      {saesoner.status === 'ready' && (
        <div className="indst-gruppe__kort eksport__liste">
          {saesoner.data.map((s) => (
            <LinkRaekke
              key={s.id}
              label={s.navn}
              art="handling"
              vaerdi={henter === s.id ? t('eksport.henter') : s.koerer ? t('eksport.koerer') : undefined}
              onClick={() => {
                if (henter === null) void eksporter(s.id, s.navn);
              }}
            />
          ))}
        </div>
      )}
      {fejl && (
        <p className="felt-fejl" role="alert">
          {fejl}
        </p>
      )}
    </Sheet>
  );
}
