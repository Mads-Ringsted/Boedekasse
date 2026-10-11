import { useState } from 'react';
import { useBodekasse } from '../bodekasse/BodekasseProvider.tsx';
import { Avatar } from '../components/Avatar.tsx';
import { formatKr, t } from '../strings/index.ts';
import { rpcErrorText } from '../supabase/rpcErrors.ts';
import { useHent } from '../supabase/useHent.ts';
import { afventerTilMig, meldtTekst, type Melding } from './betal.ts';
import { behandlBetalingsmelding, hentMeldinger } from './hentBetal.ts';
import './Betal.css';

interface AfventerKortProps {
  /** `hjem`: one card with a row per report (hjem-afventer.html). `kassen`: one slim card per report (kassen.html). */
  variant: 'hjem' | 'kassen';
  /** Change it to make the card load again (e.g. after the Betal sheet reported a payment). */
  opdater?: number;
  /** Called after a report was confirmed or rejected; reload the screen's figures. */
  onBehandlet: () => void;
}

/**
 * "Afventer bekræftelse": the reports you can act on, with Afvis / Bekræft.
 * Every Medlem sees the others' reports; an Admin sees their own too.
 * Renders nothing when there is nothing to act on.
 */
export function AfventerKort({ variant, opdater = 0, onBehandlet }: AfventerKortProps) {
  const { bodekasseId, medlemId, erAdmin } = useBodekasse();
  const hentet = useHent(() => hentMeldinger(bodekasseId), [bodekasseId, opdater]);
  if (hentet.status !== 'ready') return null;
  const meldinger = afventerTilMig(hentet.data, medlemId, erAdmin);
  if (meldinger.length === 0) return null;

  const behandlet = () => {
    hentet.reload();
    onBehandlet();
  };

  if (variant === 'kassen') {
    return meldinger.map((m) => <Raekke key={m.id} melding={m} variant="kassen" onBehandlet={behandlet} />);
  }
  return (
    <section className="afventer-kort afventer-hjem" aria-label={t('afventer.titel')}>
      <span className="afventer-kort__status">
        <span className="afventer-kort__prik" aria-hidden="true" />
        {t('afventer.titel')}
      </span>
      {meldinger.map((m) => (
        <Raekke key={m.id} melding={m} variant="hjem" onBehandlet={behandlet} />
      ))}
    </section>
  );
}

function Raekke({ melding, variant, onBehandlet }: { melding: Melding; variant: 'hjem' | 'kassen'; onBehandlet: () => void }) {
  const { medlemId } = useBodekasse();
  const [busy, setBusy] = useState(false);
  const [fejl, setFejl] = useState<string | null>(null);
  // One ID per report: a retry of Afvis or Bekræft never runs twice.
  const [klientId] = useState(() => crypto.randomUUID());
  const egen = melding.medlemId === medlemId;
  const beloeb = formatKr(melding.beloeb);
  const titel = egen ? t('afventer.duHarBetalt', { beloeb }) : t('afventer.harBetalt', { navn: melding.navn, beloeb });

  async function behandl(bekraeft: boolean) {
    setBusy(true);
    setFejl(null);
    try {
      await behandlBetalingsmelding(klientId, melding.id, bekraeft);
      onBehandlet();
    } catch (error) {
      setFejl(rpcErrorText(error));
      setBusy(false);
    }
  }

  const knapper = (
    <>
      <button type="button" className="afventer__afvis" disabled={busy} onClick={() => void behandl(false)}>
        {t('afventer.afvis')}
      </button>
      <button type="button" className="afventer__bekraeft" disabled={busy} onClick={() => void behandl(true)}>
        {t('afventer.bekraeft')}
      </button>
    </>
  );
  const fejlTekst = fejl && (
    <p className="betal__fejl afventer__fejl" role="alert">
      {fejl}
    </p>
  );

  if (variant === 'kassen') {
    return (
      <div className="afventer-kort afventer-kassen">
        <div className="afventer-kassen__raekke">
          <span className="afventer-kassen__tekst">
            <span className="afventer-kort__status afventer-kort__status--lille">
              <span className="afventer-kort__prik" aria-hidden="true" />
              {t('afventer.kort')}
            </span>
            <span className="afventer__titel">{titel}</span>
          </span>
          {knapper}
        </div>
        {fejlTekst}
      </div>
    );
  }
  return (
    <div className="afventer-hjem__melding">
      <div className="afventer-hjem__hvem">
        <Avatar navn={melding.fuldtNavn} size={40} egen={egen} />
        <span className="afventer-hjem__tekst">
          <span className="afventer__titel">{titel}</span>
          <span className="afventer-hjem__tid">{meldtTekst(melding.meldt)}</span>
        </span>
      </div>
      <div className="afventer-hjem__knapper">{knapper}</div>
      {fejlTekst}
    </div>
  );
}
