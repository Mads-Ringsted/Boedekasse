import { useState } from 'react';
import { ChevronRight, Ellipsis } from 'lucide-react';
import { useBodekasse, useMedlemskaber } from '../bodekasse/BodekasseProvider.tsx';
import { Avatar } from '../components/Avatar.tsx';
import { Sheet } from '../components/Sheet.tsx';
import { KoebFrikobSheet } from '../frikob/KoebFrikobSheet.tsx';
import { RegistrerIndbetalingSheet } from '../kassen/RegistrerIndbetalingSheet.tsx';
import { useProfilTilbage } from '../profil/aabnProfil.ts';
import type { ProfilDelProps } from '../profil/handlinger.ts';
import { t } from '../strings/index.ts';
import { supabase } from '../supabase/index.ts';
import { rpcErrorText } from '../supabase/rpcErrors.ts';
import { useHent } from '../supabase/useHent.ts';
import { adminHandlinger, type AdminHandling, type SletGrund } from './adminHandlinger.ts';
import { BekraeftSheet, RetFeltSheet } from './AdminSheets.tsx';
import { hentAdminData, type AdminData } from './hentAdminData.ts';
import './AdminHandlinger.css';

type Art = AdminHandling['art'];

const SLET_GRUND = {
  logget_ind: 'adminHandlinger.sletGrund.logget_ind',
  boeder: 'adminHandlinger.sletGrund.boeder',
  gebyrer: 'adminHandlinger.sletGrund.gebyrer',
  indbetalinger: 'adminHandlinger.sletGrund.indbetalinger',
  historik: 'adminHandlinger.sletGrund.historik',
} as const satisfies Record<SletGrund, string>;

/**
 * The Admin actions entry at the top right of a profile (PROFIL_TOP). Opens
 * "Handlinger for X"; picking a row closes it and opens that action's sheet.
 */
export function AdminHandlingerKnap(props: ProfilDelProps) {
  const { profil, mig } = props;
  // Which sheet is open. Each opening counts up, so it loads fresh; each action
  // sheet mounts fresh too (new one-time ID).
  const [vis, setVis] = useState<{ art: Art | 'liste'; aabning: number } | null>(null);
  const [aabninger, setAabninger] = useState(0);
  if (!mig.erAdmin) return null;
  const titel = t('adminHandlinger.titel', { navn: profil.navn });

  return (
    <>
      <button
        type="button"
        className="admin-knap"
        aria-label={titel}
        onClick={() => {
          setVis({ art: 'liste', aabning: aabninger + 1 });
          setAabninger((n) => n + 1);
        }}
      >
        <Ellipsis size={20} strokeWidth={2.4} aria-hidden="true" />
      </button>
      {vis && (
        <AdminSheet
          key={vis.aabning}
          {...props}
          art={vis.art}
          vaelg={(art) => setVis((v) => v && { ...v, art })}
          luk={() => setVis(null)}
        />
      )}
    </>
  );
}

interface AdminSheetProps extends ProfilDelProps {
  art: Art | 'liste';
  vaelg: (art: Art) => void;
  luk: () => void;
}

/** The open sheet: the list, or one action. */
function AdminSheet({ profil, visning, opdater, art, vaelg, luk }: AdminSheetProps) {
  const { bodekasseId, bodekasseNavn } = useBodekasse();
  const { reload: genindlaesMedlemskaber } = useMedlemskaber();
  const { tilbage } = useProfilTilbage();
  const data = useHent(() => hentAdminData(bodekasseId, profil.id), [bodekasseId, profil.id]);
  const navn = profil.navn;
  const base = { p_bodekasse: bodekasseId, p_medlem: profil.id };
  const onOpenChange = (aaben: boolean) => !aaben && luk();
  const faerdig = () => {
    luk();
    opdater();
  };

  switch (art) {
    case 'liste':
      return (
        <Sheet open onOpenChange={onOpenChange} height="partial" title={t('adminHandlinger.titel', { navn })}>
          <AdminListe {...{ profil, visning, vaelg }} data={data.status === 'ready' ? data.data : null} />
          {data.status === 'error' && (
            <button type="button" className="felt-fejl admin-liste__fejl" onClick={data.reload}>
              {rpcErrorText(data.error)} · {t('handling.proevIgen')}
            </button>
          )}
        </Sheet>
      );
    case 'registrerIndbetaling':
      return <RegistrerIndbetalingSheet open onOpenChange={onOpenChange} medlemId={profil.id} onRegistreret={opdater} />;
    case 'registrerFrikob':
      // The row only shows once the data (with the Frikøb status) has loaded.
      if (data.status !== 'ready') return null;
      return (
        <KoebFrikobSheet
          open
          onOpenChange={onOpenChange}
          medlem={{ id: profil.id, navn }}
          status={data.data.frikob}
          onKoebt={opdater}
        />
      );
    case 'goerTilAdmin':
    case 'fjernSomAdmin': {
      const goer = art === 'goerTilAdmin';
      const egen = visning.egen;
      return (
        <BekraeftSheet
          open
          onOpenChange={onOpenChange}
          titel={goer ? t('adminHandlinger.goerTilAdminTitel', { navn }) : egen ? t('adminHandlinger.fjernDigSelvTitel') : t('adminHandlinger.fjernSomAdminTitel', { navn })}
          tekst={goer ? t('adminHandlinger.goerTilAdminTekst', { navn }) : egen ? t('adminHandlinger.fjernDigSelvTekst') : t('adminHandlinger.fjernSomAdminTekst', { navn })}
          knap={t(goer ? 'adminHandlinger.goerTilAdmin' : 'adminHandlinger.fjernSomAdmin')}
          kald={(id) => supabase.rpc('saet_admin', { p_klient_id: id, ...base, p_er_admin: goer })}
          onFaerdig={() => {
            // Your own role lives on your Medlemskab (Admin-only screens and buttons).
            if (egen) void genindlaesMedlemskaber();
            faerdig();
          }}
        />
      );
    }
    case 'retNavn':
      return (
        <RetFeltSheet
          open
          onOpenChange={onOpenChange}
          titel={t('adminHandlinger.retNavn')}
          label={t('adminHandlinger.navnLabel', { bodekasse: bodekasseNavn })}
          type="text"
          start={navn}
          kald={(id, v) => supabase.rpc('ret_medlem_navn', { p_klient_id: id, ...base, p_navn: v })}
          onFaerdig={faerdig}
        />
      );
    case 'retEmail':
      return (
        <RetFeltSheet
          open
          onOpenChange={onOpenChange}
          titel={t('adminHandlinger.retEmail')}
          label={t('tilfoej.email')}
          type="email"
          start={data.status === 'ready' ? (data.data.email ?? '') : ''}
          note={t('adminHandlinger.emailNote', { navn })}
          kald={(id, v) => supabase.rpc('ret_medlem_email', { p_klient_id: id, ...base, p_email: v })}
          onFaerdig={faerdig}
        />
      );
    case 'meldUd':
      return (
        <BekraeftSheet
          open
          onOpenChange={onOpenChange}
          farlig
          titel={t('adminHandlinger.meldUdTitel', { navn })}
          tekst={t('adminHandlinger.meldUdTekst', { navn })}
          knap={t('adminHandlinger.meldUd')}
          kald={(id) => supabase.rpc('udmeld', { p_klient_id: id, ...base })}
          onFaerdig={faerdig}
        />
      );
    case 'genoptag':
      return (
        <BekraeftSheet
          open
          onOpenChange={onOpenChange}
          titel={t('adminHandlinger.genoptagTitel', { navn })}
          tekst={t('adminHandlinger.genoptagTekst', { navn })}
          knap={t('adminHandlinger.genoptag')}
          kald={(id) => supabase.rpc('genoptag', { p_klient_id: id, ...base })}
          onFaerdig={faerdig}
        />
      );
    case 'slet':
      return (
        <BekraeftSheet
          open
          onOpenChange={onOpenChange}
          farlig
          titel={t('adminHandlinger.sletTitel', { navn })}
          tekst={t('adminHandlinger.sletTekst', { navn })}
          knap={t('adminHandlinger.slet')}
          kald={(id) => supabase.rpc('slet_medlem', { p_klient_id: id, ...base })}
          onFaerdig={() => {
            // The profile is gone: back to where it was opened from.
            luk();
            tilbage();
          }}
        />
      );
  }
}

/** The list (medlem-admin.html): who, then the main group, then the red group. */
function AdminListe({
  profil,
  visning,
  data,
  vaelg,
}: Pick<ProfilDelProps, 'profil' | 'visning'> & {
  data: AdminData | null;
  vaelg: (art: Art) => void;
}) {
  const { hoved, farlig } = adminHandlinger(
    { erAdmin: profil.erAdmin, loggetInd: profil.loggetInd, udmeldt: profil.udmeldt, email: data?.email ?? null },
    { egen: visning.egen, sletGrund: data?.sletGrund ?? null, frikob: data?.frikob.kanKoebe ?? false },
  );
  const under = profil.udmeldt
    ? t('profil.tag.udmeldt')
    : profil.kontoSlettet
      ? t('profil.tag.kontoSlettet')
      : !profil.loggetInd
        ? t('profil.tag.ikkeLoggetInd')
        : profil.erAdmin
          ? t('profil.tag.admin')
          : null;

  return (
    <>
      <div className="admin-liste__hvem">
        <Avatar navn={profil.navn} size={44} stiplet={!profil.loggetInd} tidligere={profil.udmeldt} />
        <span className="admin-liste__hvem-tekst">
          <span className="admin-liste__navn">{profil.navn}</span>
          {under && <span className="admin-liste__under">{under}</span>}
        </span>
      </div>
      <div className="admin-liste__gruppe">
        {hoved.map((h) => (
          <button key={h.art} type="button" className="admin-raekke" onClick={() => vaelg(h.art)}>
            <span className="admin-raekke__tekst">
              {raekkeTekst(h)}
              {h.art === 'retEmail' && (
                <span className="admin-raekke__under">{h.email ?? t('adminHandlinger.ingenEmail')}</span>
              )}
            </span>
            <ChevronRight className="admin-raekke__chevron" size={18} strokeWidth={2.2} aria-hidden="true" />
          </button>
        ))}
      </div>
      {farlig.length > 0 && (
        <div className="admin-liste__gruppe">
          {farlig.map((h) => {
            // Slet waits for the rule to load, then is disabled with a reason.
            const spaerret = h.art === 'slet' && (data === null || h.grund !== null);
            return (
              <button
                key={h.art}
                type="button"
                className={`admin-raekke${h.art === 'genoptag' ? '' : ' admin-raekke--fare'}`}
                disabled={spaerret}
                onClick={() => vaelg(h.art)}
              >
                <span className="admin-raekke__tekst">
                  {raekkeTekst(h)}
                  {h.art === 'slet' && h.grund && (
                    <span className="admin-raekke__under">{t(SLET_GRUND[h.grund], { navn: profil.navn })}</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}

function raekkeTekst(h: AdminHandling): string {
  switch (h.art) {
    case 'registrerIndbetaling':
      return t('kassen.registrer');
    case 'registrerFrikob':
      return t('frikob.registrerTitel');
    case 'goerTilAdmin':
      return t('adminHandlinger.goerTilAdmin');
    case 'fjernSomAdmin':
      return t('adminHandlinger.fjernSomAdmin');
    case 'retNavn':
      return t('adminHandlinger.retNavn');
    case 'retEmail':
      return t('adminHandlinger.retEmail');
    case 'meldUd':
      return t('adminHandlinger.meldUd');
    case 'genoptag':
      return t('adminHandlinger.genoptag');
    case 'slet':
      return t('adminHandlinger.slet');
  }
}
