import { useState } from 'react';
import { ChevronLeft, Search, ShieldCheck } from 'lucide-react';
import { useBodekasse } from '../bodekasse/BodekasseProvider.tsx';
import { Sheet } from '../components/Sheet.tsx';
import { kortNavne } from '../giv/navne.ts';
import { kortDato } from '../kategorier/kategoriListe.ts';
import { formatKr, t } from '../strings/index.ts';
import { supabase } from '../supabase/index.ts';
import { rpcErrorText } from '../supabase/rpcErrors.ts';
import { useHent } from '../supabase/useHent.ts';
import { FrikobTag } from './FrikobTag.tsx';
import { hentKoebValg, type FrikobStatus } from './hentFrikoeb.ts';
import '../medlemmer/felter.css';
import './Frikob.css';

interface KoebFrikobSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Who gets the Frikøb: yourself (Køb Frikøb) or, for an Admin, someone else (Registrér frikøb). */
  medlem: { id: string; navn: string };
  /** The Medlem's Frikøb now, the price and the Sæson (see `hentFrikobStatus`). */
  status: FrikobStatus;
  onKoebt: () => void;
}

/**
 * Køb Frikøb: 1 pick an active Bødekategori (already bought out disabled),
 * 2 confirm the price, how long it lasts and what it doesn't cover. For an
 * Admin on someone else's profile it is "Registrér frikøb" for them. Mount
 * with a fresh `key` per opening so the one-time ID is new.
 */
export function KoebFrikobSheet({ open, onOpenChange, medlem, status, onKoebt }: KoebFrikobSheetProps) {
  const { bodekasseId, medlemId: migId } = useBodekasse();
  const egen = medlem.id === migId;
  const valg = useHent(
    () => hentKoebValg(bodekasseId, medlem.id, status.frikoeb),
    [bodekasseId, medlem.id, status.frikoeb],
  );
  const [trin, setTrin] = useState<1 | 2>(1);
  const [valgtId, setValgtId] = useState<string | null>(null);
  const [soeg, setSoeg] = useState('');
  const [busy, setBusy] = useState(false);
  const [fejl, setFejl] = useState<string | null>(null);
  const [klientId] = useState(() => crypto.randomUUID());

  const kategorier = valg.status === 'ready' ? valg.data : [];
  const valgt = kategorier.find((k) => k.id === valgtId && !k.koebt);
  const ord = soeg.trim().toLocaleLowerCase('da');
  const viste = ord ? kategorier.filter((k) => k.navn.toLocaleLowerCase('da').includes(ord)) : kategorier;
  const fornavn = kortNavne([medlem.navn])[0] ?? medlem.navn;
  const pris = formatKr(status.pris);

  async function koeb() {
    if (!valgt || busy) return;
    setBusy(true);
    setFejl(null);
    const { error } = await supabase.rpc('koeb_frikob', {
      p_klient_id: klientId,
      p_bodekasse: bodekasseId,
      p_bodekategori: valgt.id,
      ...(egen ? {} : { p_medlem: medlem.id }),
    });
    setBusy(false);
    if (error) {
      setFejl(rpcErrorText(error));
      return;
    }
    onOpenChange(false);
    onKoebt();
  }

  const slut = status.saeson?.slutdato;
  const footer =
    trin === 1 ? (
      <button type="button" className="felt-knap" disabled={!valgt} onClick={() => setTrin(2)}>
        {t('frikob.naeste')}
      </button>
    ) : (
      <>
        {fejl && (
          <p className="felt-fejl frikob__fejl" role="alert">
            {fejl}
          </p>
        )}
        <button type="button" className="felt-knap" disabled={busy} onClick={() => void koeb()}>
          {t(egen ? 'frikob.koeb' : 'frikob.registrer', { beloeb: pris })}
        </button>
      </>
    );

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      height="full"
      title={t(egen ? 'frikob.titel' : 'frikob.registrerTitel')}
      leadingLabel={
        trin === 2 ? (
          <>
            <ChevronLeft size={22} strokeWidth={2.4} aria-hidden="true" />
            {t('sheet.tilbage')}
          </>
        ) : undefined
      }
      onLeading={trin === 2 ? () => setTrin(1) : undefined}
      trailing={t('frikob.trin', { nr: trin })}
      footer={footer}
    >
      {trin === 1 ? (
        <>
          <p className="frikob__intro">{t('frikob.prisLinje', { beloeb: pris })}</p>
          <label className="frikob__soeg">
            <Search size={18} strokeWidth={2} aria-hidden="true" />
            <input
              type="search"
              aria-label={t('giv.soeg')}
              placeholder={t('giv.soeg')}
              value={soeg}
              onChange={(e) => setSoeg(e.target.value)}
            />
          </label>
          {valg.status === 'error' && (
            <button type="button" className="felt-fejl" onClick={valg.reload}>
              {rpcErrorText(valg.error)}
            </button>
          )}
          {valg.status === 'ready' && kategorier.length === 0 && (
            <p className="felt-note">{t('frikob.ingenKategorier')}</p>
          )}
          {viste.length > 0 && (
            <div role="radiogroup" aria-label={t('frikob.titel')} className="frikob-valg">
              {viste.map((k) => {
                const tjekket = k.id === valgtId && !k.koebt;
                return (
                  <button
                    key={k.id}
                    type="button"
                    role="radio"
                    aria-checked={tjekket}
                    disabled={k.koebt}
                    className={`frikob-valg__raekke${tjekket ? ' frikob-valg__raekke--valgt' : ''}`}
                    onClick={() => setValgtId(k.id)}
                  >
                    <span className="frikob-valg__radio" aria-hidden="true" />
                    <span className="frikob-valg__tekst">
                      <span className="frikob-valg__navn">
                        {k.navn}
                        {k.koebt && <FrikobTag />}
                      </span>
                      <span className="frikob-valg__under">
                        {k.koebt
                          ? t('frikob.alleredeKoebt')
                          : t(egen ? 'frikob.kategoriLinje' : 'frikob.kategoriLinjeAnden', {
                              pris: formatKr(k.pris),
                              antal: k.faaet,
                            })}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </>
      ) : (
        valgt && (
          <div className="frikob-bekraeft">
            <div className="frikob-bekraeft__top">
              <span className="frikob-bekraeft__ikon" aria-hidden="true">
                <ShieldCheck size={36} strokeWidth={1.8} />
              </span>
              <span className="frikob-bekraeft__titel">{t('frikob.paa', { navn: valgt.navn })}</span>
              <span className="frikob-bekraeft__tekst">
                {egen
                  ? t('frikob.ingenKanGiveDig', { navn: valgt.navn })
                  : t('frikob.ingenKanGive', { person: fornavn, navn: valgt.navn })}
              </span>
            </div>
            <dl className="frikob-bekraeft__liste">
              <div>
                <dt>{t('frikob.gebyr')}</dt>
                <dd className="frikob-bekraeft__pris">{pris}</dd>
              </div>
              <div>
                <dt>{t('frikob.gaelderFra')}</dt>
                <dd>{t('frikob.nu')}</dd>
              </div>
              <div>
                <dt>{t('frikob.gaelderTil')}</dt>
                <dd>{slut ? t('frikob.saesonSlutDato', { dato: kortDato(slut) }) : t('frikob.saesonSlut')}</dd>
              </div>
            </dl>
            <p className="felt-note">{t('frikob.daekkerIkke', { navn: valgt.navn })}</p>
          </div>
        )
      )}
    </Sheet>
  );
}
