import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { Gruppe, LinkRaekke, SwitchRaekke } from '../indstillinger/raekker.tsx';
import type { ProfilDelProps } from '../profil/handlinger.ts';
import { t, type PlainStringId } from '../strings/index.ts';
import { supabase } from '../supabase/index.ts';
import { rpcErrorText } from '../supabase/rpcErrors.ts';
import { useHent } from '../supabase/useHent.ts';
import { gemAbonnement, laesEnhed, slaaFra, slaaTil, type Enhed } from './enhed.ts';
import { notifikationTilstand, praeferencer, PUSH_ARTER, type PushArt } from './push.ts';
import './Notifikationer.css';

const LABEL: Record<PushArt, PlainStringId> = {
  bode_modtaget: 'notifikationer.art.bode_modtaget',
  anke_afstemning: 'notifikationer.art.anke_afstemning',
  anke_resultat: 'notifikationer.art.anke_resultat',
  betalingsmelding_venter: 'notifikationer.art.betalingsmelding_venter',
  betaling_bekraeftet: 'notifikationer.art.betaling_bekraeftet',
  automatisk_gebyr: 'notifikationer.art.automatisk_gebyr',
  betalingspaamindelse: 'notifikationer.art.betalingspaamindelse',
};

async function hentPraeferencer(): Promise<Record<PushArt, boolean>> {
  const { data, error } = await supabase.from('push_praeference').select('*').maybeSingle();
  if (error) throw error;
  return praeferencer(data);
}

/**
 * "Notifikationer" on your own profile: the install card in a browser, the
 * "Slå notifikationer til" card in the app, and once this device is on, one
 * toggle per push type (per person, for all their Bødekasser).
 */
export function NotifikationerKort({ visning }: ProfilDelProps) {
  if (!visning.egen) return null;
  return <Notifikationer />;
}

function Notifikationer() {
  const [enhed, setEnhed] = useState<Enhed | null>(null);
  const [busy, setBusy] = useState(false);
  const [fejl, setFejl] = useState<string | null>(null);

  useEffect(() => {
    void laesEnhed().then((e) => {
      setEnhed(e);
      // Keep the server's copy current for whoever is logged in now.
      if (e.abonnement && e.tilladelse === 'granted') void gemAbonnement(e.abonnement).catch(() => {});
    });
  }, []);

  if (!enhed) return null;
  const { registrering, abonnement } = enhed;
  const tilstand = notifikationTilstand(enhed);

  async function koer(handling: () => Promise<unknown>) {
    setBusy(true);
    setFejl(null);
    try {
      await handling();
    } catch (error) {
      setFejl(rpcErrorText(error));
    }
    setEnhed(await laesEnhed());
    setBusy(false);
  }

  return (
    <>
      <h2 className="profil__sektion">{t('notifikationer.titel')}</h2>
      {tilstand === 'installer' && <InstallerNotifikationerKort />}
      {tilstand === 'ikkeUnderstoettet' && (
        <p className="notif__kort notif__tekst">{t('notifikationer.ikkeUnderstoettet')}</p>
      )}
      {tilstand === 'blokeret' && <p className="notif__kort notif__tekst">{t('notifikationer.blokeret')}</p>}
      {tilstand === 'slaaTil' && registrering && (
        <div className="notif__kort">
          <span className="notif__titel">
            <Bell size={18} strokeWidth={2.2} aria-hidden="true" />
            {t('notifikationer.slaaTilTitel')}
          </span>
          <span className="notif__tekst">{t('notifikationer.slaaTilTekst')}</span>
          <button
            type="button"
            className="notif__knap"
            disabled={busy}
            onClick={() => void koer(() => slaaTil(registrering))}
          >
            {t('notifikationer.slaaTilKnap')}
          </button>
        </div>
      )}
      {tilstand === 'til' && abonnement && <Toggles onSlaaFra={() => !busy && void koer(() => slaaFra(abonnement))} />}
      {fejl && (
        <p className="notif__fejl" role="alert">
          {fejl}
        </p>
      )}
    </>
  );
}

/** One switch per push type; each tap saves at once. */
function Toggles({ onSlaaFra }: { onSlaaFra: () => void }) {
  const hentet = useHent(hentPraeferencer, []);
  const [lokal, setLokal] = useState<Partial<Record<PushArt, boolean>>>({});
  const [fejl, setFejl] = useState<string | null>(null);
  if (hentet.status !== 'ready') return null;
  const til = { ...hentet.data, ...lokal };

  async function skift(art: PushArt, vaerdi: boolean) {
    setFejl(null);
    setLokal((l) => ({ ...l, [art]: vaerdi }));
    const { error } = await supabase.rpc('saet_push_praeference', { p_art: art, p_til: vaerdi });
    if (error) {
      setLokal((l) => ({ ...l, [art]: !vaerdi }));
      setFejl(rpcErrorText(error));
    }
  }

  return (
    <>
      <Gruppe>
        {PUSH_ARTER.map((art) => (
          <SwitchRaekke key={art} label={t(LABEL[art])} til={til[art]} onSkift={(v) => void skift(art, v)} />
        ))}
        <LinkRaekke art="handling" label={t('notifikationer.slaaFra')} onClick={onSlaaFra} />
      </Gruppe>
      <p className="notif__note">{t('notifikationer.note')}</p>
      {fejl && (
        <p className="notif__fejl" role="alert">
          {fejl}
        </p>
      )}
    </>
  );
}

/** "Installér appen for at få notifikationer": push can't work in a browser tab. */
export function InstallerNotifikationerKort() {
  return (
    <div className="notif__kort">
      <span className="notif__titel">
        <Bell size={18} strokeWidth={2.2} aria-hidden="true" />
        {t('notifikationer.installerTitel')}
      </span>
      <span className="notif__tekst">{t('notifikationer.installerTekst')}</span>
    </div>
  );
}
