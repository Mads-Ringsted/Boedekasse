import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { useNavigate } from 'react-router';
import { BackButton } from '../components/BackButton.tsx';
import { Screen } from '../components/Screen.tsx';
import { Gruppe, LinkRaekke, SwitchRaekke } from '../indstillinger/raekker.tsx';
import { t, type PlainStringId } from '../strings/index.ts';
import { supabase } from '../supabase/index.ts';
import { rpcErrorText } from '../supabase/rpcErrors.ts';
import { useHent } from '../supabase/useHent.ts';
import { laesEnhed, laesOgOpfriskEnhed, slaaFra, slaaTil, type Enhed } from './enhed.ts';
import { notifikationStatus, notifikationTilstand, praeferencer, PUSH_ARTER, type PushArt } from './push.ts';
import './Notifikationer.css';

const LABEL: Record<PushArt, PlainStringId> = {
  bode_modtaget: 'notifikationer.art.bode_modtaget',
  anke_afstemning: 'notifikationer.art.anke_afstemning',
  anke_resultat: 'notifikationer.art.anke_resultat',
  betalingsmelding_venter: 'notifikationer.art.betalingsmelding_venter',
  betaling_bekraeftet: 'notifikationer.art.betaling_bekraeftet',
  automatisk_gebyr: 'notifikationer.art.automatisk_gebyr',
  betalingspaamindelse: 'notifikationer.art.betalingspaamindelse',
  andres_aktivitet: 'notifikationer.art.andres_aktivitet',
};

/** A line under the toggle, for kinds that need one. */
const UNDER: Partial<Record<PushArt, PlainStringId>> = {
  andres_aktivitet: 'notifikationer.art.andres_aktivitetUnder',
};

async function hentPraeferencer(): Promise<Record<PushArt, boolean>> {
  const { data, error } = await supabase.from('push_praeference').select('*').maybeSingle();
  if (error) throw error;
  return praeferencer(data);
}

/** "Til" or "Fra" for the Notifikationer row on Mere (see `notifikationStatus`). */
export async function hentNotifikationStatus(): Promise<string> {
  const enhed = await laesOgOpfriskEnhed();
  const valg = notifikationTilstand(enhed) === 'til' ? await hentPraeferencer() : praeferencer(null);
  return notifikationStatus(enhed, valg);
}

/**
 * Mere → Notifikationer: the "Slå notifikationer til" card, or once this
 * device is on, one toggle per push type (per person, for all their
 * Bødekasser).
 */
export function Notifikationer() {
  const navigate = useNavigate();
  const [enhed, setEnhed] = useState<Enhed | null>(null);
  const [busy, setBusy] = useState(false);
  const [fejl, setFejl] = useState<string | null>(null);

  useEffect(() => {
    void laesOgOpfriskEnhed().then(setEnhed);
  }, []);

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

  const tilstand = enhed && notifikationTilstand(enhed);
  const registrering = enhed?.registrering;
  const abonnement = enhed?.abonnement;

  return (
    <Screen>
      <BackButton label={t('tab.mere')} onClick={() => void navigate('/mere')} />
      <h1 className="screen__title">{t('notifikationer.titel')}</h1>
      {tilstand === 'ikkeUnderstoettet' && (
        <p className="notif__kort notif__tekst">{t('notifikationer.ikkeUnderstoettet')}</p>
      )}
      {tilstand === 'blokeret' && <p className="notif__kort notif__tekst">{t('notifikationer.blokeret')}</p>}
      {tilstand === 'slaaTil' && registrering && (
        <SlaaTilKort busy={busy} onSlaaTil={() => void koer(() => slaaTil(registrering))} />
      )}
      {tilstand === 'til' && abonnement && <Toggles onSlaaFra={() => !busy && void koer(() => slaaFra(abonnement))} />}
      {fejl && (
        <p className="notif__fejl" role="alert">
          {fejl}
        </p>
      )}
    </Screen>
  );
}

/** "Slå notifikationer til". The tap itself asks for permission (iOS needs the gesture). */
function SlaaTilKort({ busy, onSlaaTil }: { busy: boolean; onSlaaTil: () => void }) {
  return (
    <div className="notif__kort">
      <span className="notif__titel">
        <Bell size={18} strokeWidth={2.2} aria-hidden="true" />
        {t('notifikationer.slaaTilTitel')}
      </span>
      <span className="notif__tekst">{t('notifikationer.slaaTilTekst')}</span>
      <button type="button" className="notif__knap" disabled={busy} onClick={onSlaaTil}>
        {t('notifikationer.slaaTilKnap')}
      </button>
    </div>
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
        {PUSH_ARTER.map((art) => {
          const under = UNDER[art];
          return (
            <SwitchRaekke
              key={art}
              label={t(LABEL[art])}
              {...(under ? { under: t(under) } : {})}
              til={til[art]}
              onSkift={(v) => void skift(art, v)}
            />
          );
        })}
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

/** "Installér appen for at få notifikationer", on the install guide: push can't work in a browser tab. */
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
