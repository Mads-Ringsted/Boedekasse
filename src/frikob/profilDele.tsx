import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useBodekasse } from '../bodekasse/BodekasseProvider.tsx';
import type { ProfilDelProps } from '../profil/handlinger.ts';
import { ProfilKnap } from '../profil/knapper.tsx';
import { t } from '../strings/index.ts';
import { useHent } from '../supabase/useHent.ts';
import { AnnullerFrikobSheet } from './AnnullerFrikobSheet.tsx';
import { iSaeson, type AktivtFrikob } from './frikob.ts';
import { hentFrikobStatus } from './hentFrikoeb.ts';
import { KoebFrikobSheet } from './KoebFrikobSheet.tsx';
import './Frikob.css';

/** The profile's Medlem's Frikøb status; reloads whenever the profile does. */
function useFrikobStatus(profil: ProfilDelProps['profil']) {
  const { bodekasseId } = useBodekasse();
  // `profil` is a new object after every profile reload (opdater, Giv, Bøde).
  return useHent(() => hentFrikobStatus(bodekasseId, profil.id), [bodekasseId, profil]);
}

/**
 * "Køb Frikøb" on your own profile, or "Registrér frikøb" (Admin) on an
 * active Medlem's profile. Only while Frikøb is on and a Sæson runs.
 */
export function KoebFrikobKnap({ profil, visning, mig, opdater }: ProfilDelProps) {
  const status = useFrikobStatus(profil);
  // Each opening mounts a fresh sheet (new one-time ID).
  const [aabning, setAabning] = useState(0);
  const maa = visning.egen || (mig.erAdmin && !profil.udmeldt);
  if (!maa || status.status !== 'ready' || !status.data.kanKoebe) return null;
  return (
    <>
      <ProfilKnap
        Icon={ShieldCheck}
        label={t(visning.egen ? 'frikob.titel' : 'frikob.registrerTitel')}
        under={visning.egen ? undefined : t('profil.kunAdmin')}
        onClick={() => setAabning((n) => n + 1)}
      />
      {aabning > 0 && (
        <KoebFrikobSheet
          key={aabning}
          open
          onOpenChange={(aaben) => !aaben && setAabning(0)}
          medlem={{ id: profil.id, navn: profil.navn }}
          status={status.data}
          onKoebt={opdater}
        />
      )}
    </>
  );
}

/** "Frikøb i sæson 2026": one chip per bought-out Bødekategori. An Admin taps one to annul it. */
export function FrikobKort({ profil, mig, opdater }: ProfilDelProps) {
  const status = useFrikobStatus(profil);
  const [annullerer, setAnnullerer] = useState<{ nr: number; frikob: AktivtFrikob } | null>(null);
  if (status.status !== 'ready' || status.data.frikoeb.length === 0) return null;
  const { saeson, frikoeb } = status.data;
  return (
    <section className="profil__kort" aria-label={t('frikob.tag')}>
      <span className="frikob-kort__titel">
        {saeson ? t('frikob.iSaeson', { saeson: iSaeson(saeson.navn) }) : t('frikob.tag')}
      </span>
      <div className="frikob-chips">
        {frikoeb.map((f) =>
          mig.erAdmin ? (
            <button
              key={f.id}
              type="button"
              className="frikob-chip"
              onClick={() => setAnnullerer((a) => ({ nr: (a?.nr ?? 0) + 1, frikob: f }))}
            >
              <ShieldCheck size={16} strokeWidth={2.2} aria-hidden="true" />
              {f.bodekategoriNavn}
            </button>
          ) : (
            <span key={f.id} className="frikob-chip">
              <ShieldCheck size={16} strokeWidth={2.2} aria-hidden="true" />
              {f.bodekategoriNavn}
            </span>
          ),
        )}
      </div>
      {annullerer && (
        <AnnullerFrikobSheet
          key={annullerer.nr}
          open
          onOpenChange={(aaben) => !aaben && setAnnullerer(null)}
          frikob={annullerer.frikob}
          onAnnulleret={opdater}
        />
      )}
    </section>
  );
}
