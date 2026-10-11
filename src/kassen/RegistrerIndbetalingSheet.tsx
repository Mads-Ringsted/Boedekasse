import { useState, type FormEvent } from 'react';
import { ChevronRight } from 'lucide-react';
import { useBodekasse } from '../bodekasse/BodekasseProvider.tsx';
import { Avatar } from '../components/Avatar.tsx';
import { Sheet } from '../components/Sheet.tsx';
import { kortNavne } from '../giv/navne.ts';
import { parsePris } from '../kategorier/kategoriListe.ts';
import { formatKr, t } from '../strings/index.ts';
import { supabase } from '../supabase/index.ts';
import { rpcErrorText } from '../supabase/rpcErrors.ts';
import { useHent } from '../supabase/useHent.ts';
import { hentBetalere } from './hentKassen.ts';
import { forudfyldtBeloeb, type Betaler } from './kassen.ts';
import '../medlemmer/felter.css';
import './Kassen.css';

interface RegistrerIndbetalingSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Start with this Medlem picked (from a Medlem's profile). Without it, the sheet asks who paid. */
  medlemId?: string;
  onRegistreret: () => void;
}

const FORM_ID = 'registrer-indbetaling';

/**
 * Registrér indbetaling (Admin): who paid (anyone, yourself and Udmeldte
 * too), the amount pre-filled with what they owe, and an optional note.
 * Mount with a fresh `key` per opening so the one-time ID is new.
 */
export function RegistrerIndbetalingSheet({ open, onOpenChange, medlemId, onRegistreret }: RegistrerIndbetalingSheetProps) {
  const { bodekasseId, medlemId: mitId } = useBodekasse();
  const liste = useHent(() => hentBetalere(bodekasseId), [bodekasseId]);
  const klar = liste.status === 'ready' ? liste.data : null;
  const [valgtId, setValgtId] = useState<string | null>(medlemId ?? null);
  const [vaelger, setVaelger] = useState(!medlemId);
  const [beloeb, setBeloeb] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [fejl, setFejl] = useState<string | null>(null);
  // One ID per Indbetaling, so "Prøv igen" never registers it twice.
  const [klientId] = useState(() => crypto.randomUUID());

  const valgt = klar && [...klar.aktive, ...klar.udmeldte].find((b) => b.id === valgtId);
  // Until the amount is edited, it follows what the picked Medlem owes.
  const tekst = beloeb ?? (valgt ? forudfyldtBeloeb(valgt.saldo) : '');
  const kr = parsePris(tekst);
  const fornavn = valgt ? (kortNavne([valgt.navn])[0] ?? valgt.navn) : '';
  const kanRegistrere = valgt && kr !== null && !busy;

  function vaelg(b: Betaler) {
    setValgtId(b.id);
    setBeloeb(null);
    setVaelger(false);
  }

  async function registrer(event: FormEvent) {
    event.preventDefault();
    if (!kanRegistrere) return;
    setBusy(true);
    setFejl(null);
    const { error } = await supabase.rpc('registrer_indbetaling', {
      p_klient_id: klientId,
      p_bodekasse: bodekasseId,
      p_medlem: valgt.id,
      p_beloeb: kr,
      p_note: note,
    });
    setBusy(false);
    if (error) {
      setFejl(rpcErrorText(error));
      return;
    }
    onOpenChange(false);
    onRegistreret();
  }

  const navnFor = (b: Betaler) => (b.id === mitId ? t('registrer.dig', { navn: b.navn }) : b.navn);

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      height="full"
      title={t('registrer.titel')}
      footer={
        !vaelger && (
          <button type="submit" form={FORM_ID} className="felt-knap" disabled={!kanRegistrere}>
            {kr !== null ? t('registrer.knap', { beloeb: formatKr(kr) }) : t('registrer.knapUdenBeloeb')}
          </button>
        )
      }
    >
      {liste.status === 'error' && (
        <button type="button" className="kassen__fejl" onClick={liste.reload}>
          {rpcErrorText(liste.error)} · {t('handling.proevIgen')}
        </button>
      )}

      {klar && vaelger && (
        <>
          <h2 className="registrer__label">{t('registrer.vaelg')}</h2>
          <BetalerListe betalere={klar.aktive} navnFor={navnFor} onVaelg={vaelg} mitId={mitId} />
          {klar.udmeldte.length > 0 && (
            <>
              <h2 className="registrer__label">{t('registrer.udmeldte')}</h2>
              <BetalerListe betalere={klar.udmeldte} navnFor={navnFor} onVaelg={vaelg} mitId={mitId} />
            </>
          )}
        </>
      )}

      {valgt && !vaelger && (
        <form id={FORM_ID} onSubmit={(e) => void registrer(e)}>
          <h2 className="registrer__label">{t('registrer.fra')}</h2>
          <button type="button" className="registrer__fra" onClick={() => setVaelger(true)}>
            <Avatar navn={valgt.navn} size={40} egen={valgt.id === mitId} tidligere={valgt.udmeldt} />
            <span className="registrer__fra-tekst">
              <span className="registrer__fra-navn">{navnFor(valgt)}</span>
              <SaldoTekst saldo={valgt.saldo} />
            </span>
            <span className="registrer__skift">{t('registrer.skift')}</span>
          </button>

          <div className="registrer__beloeb">
            <span className="registrer__beloeb-label">{t('registrer.beloeb')}</span>
            <label className="registrer__beloeb-felt">
              <input
                className="registrer__beloeb-input"
                type="text"
                inputMode="numeric"
                value={tekst}
                onChange={(e) => setBeloeb(e.target.value)}
                placeholder="0"
                aria-label={t('registrer.beloebLabel')}
                aria-invalid={tekst !== '' && kr === null}
                // As wide as its digits, so "120 kr" stays centred.
                style={{ width: `${Math.max(tekst.length, 1) + 0.4}ch` }}
                autoComplete="off"
              />
              <span className="registrer__kr">{t('registrer.kr')}</span>
            </label>
            <span className="registrer__beloeb-note">
              {tekst !== '' && kr === null
                ? t('registrer.ugyldigt')
                : valgt.saldo <= 0
                  ? t('registrer.skylderIntetNote', { navn: fornavn })
                  : beloeb === null
                    ? t('registrer.udfyldt', { navn: fornavn })
                    : '\u00a0'}
            </span>
          </div>

          <input
            className="felt__input registrer__note"
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('registrer.note')}
            aria-label={t('registrer.note')}
            enterKeyHint="done"
          />

          {fejl && (
            <p className="felt-fejl" role="alert">
              {fejl}
            </p>
          )}
        </form>
      )}
    </Sheet>
  );
}

function SaldoTekst({ saldo }: { saldo: number }) {
  if (saldo > 0) return <span className="registrer__saldo registrer__saldo--mangler">{t('registrer.mangler', { beloeb: formatKr(saldo) })}</span>;
  if (saldo < 0) return <span className="registrer__saldo registrer__saldo--til-gode">{t('registrer.tilGode', { beloeb: formatKr(-saldo) })}</span>;
  return <span className="registrer__saldo">{t('registrer.skylderIntet')}</span>;
}

interface BetalerListeProps {
  betalere: Betaler[];
  navnFor: (b: Betaler) => string;
  onVaelg: (b: Betaler) => void;
  mitId: string;
}

function BetalerListe({ betalere, navnFor, onVaelg, mitId }: BetalerListeProps) {
  return (
    <ul className="registrer__liste">
      {betalere.map((b) => (
        <li key={b.id}>
          <button type="button" className="registrer__betaler" onClick={() => onVaelg(b)}>
            <Avatar navn={b.navn} size={36} egen={b.id === mitId} tidligere={b.udmeldt} />
            <span className="registrer__fra-tekst">
              <span className="registrer__fra-navn">{navnFor(b)}</span>
              <SaldoTekst saldo={b.saldo} />
            </span>
            <ChevronRight className="registrer__chevron" size={18} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  );
}
