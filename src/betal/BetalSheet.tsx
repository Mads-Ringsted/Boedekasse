import { useEffect, useState, type FormEvent } from 'react';
import { Check, Copy, X } from 'lucide-react';
import { useBodekasse } from '../bodekasse/BodekasseProvider.tsx';
import { Avatar } from '../components/Avatar.tsx';
import { Field } from '../components/Field.tsx';
import { primaryAction, typedRequirement, visibleError } from '../components/fieldRules.ts';
import { Sheet, SheetClose, SheetTitle } from '../components/Sheet.tsx';
import { SheetAction } from '../components/SheetAction.tsx';
import { forudfyldtBeloeb } from '../kassen/kassen.ts';
import { parsePris } from '../kategorier/kategoriListe.ts';
import { formatKr, t } from '../strings/index.ts';
import { rpcErrorText } from '../supabase/rpcErrors.ts';
import { useHent } from '../supabase/useHent.ts';
import { hentBetal, meldBetaling } from './hentBetal.ts';
import { MinMeldingKort } from './MinMeldingKort.tsx';
import '../medlemmer/felter.css';
import './Betal.css';

interface BetalSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after you reported or withdrew a payment, so the screen behind can reload. */
  onAendret?: () => void;
}

const FORM_ID = 'betal';

/**
 * Betal: what you owe, the MobilePay Box number with Kopiér (or "Betal til en
 * Admin" when none is set), three steps, and "Jeg har betalt X kr" with an
 * editable amount. After reporting, it shows the orange Afventer card with
 * Fortryd. Mount with a fresh `key` per opening so the one-time ID is new.
 */
export function BetalSheet({ open, onOpenChange, onAendret }: BetalSheetProps) {
  const { bodekasseId, medlemId, erAdmin } = useBodekasse();
  const betal = useHent(() => hentBetal(bodekasseId, medlemId), [bodekasseId, medlemId]);
  const data = betal.status === 'ready' ? betal.data : null;
  const [beloeb, setBeloeb] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fejl, setFejl] = useState<string | null>(null);
  // A new ID per report: a new one after Fortryd, so you can report again.
  const [klientId, setKlientId] = useState(() => crypto.randomUUID());

  const tekst = beloeb ?? (data ? forudfyldtBeloeb(data.saldo) : '');
  const kr = parsePris(tekst);
  const melding = data?.minMelding ?? null;
  const handling = primaryAction(
    [typedRequirement(tekst, kr !== null, t('aarsag.skrivBeloeb'), t('aarsag.retBeloeb'))],
    { busy },
  );
  const kanMelde = data && !melding && kr !== null && handling.enabled;

  async function meld(event: FormEvent) {
    event.preventDefault();
    if (!kanMelde) return;
    setBusy(true);
    setFejl(null);
    try {
      await meldBetaling(klientId, bodekasseId, kr);
      betal.reload();
      onAendret?.();
    } catch (error) {
      setFejl(rpcErrorText(error));
    } finally {
      setBusy(false);
    }
  }

  function fortrudt() {
    setKlientId(crypto.randomUUID());
    setBeloeb(null);
    betal.reload();
    onAendret?.();
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      height="partial"
      title={t('betal.titel')}
      header={
        <div className="betal__header">
          <SheetTitle className="visually-hidden">{t('betal.titel')}</SheetTitle>
          <SheetClose className="sheet__close" aria-label={t('sheet.luk')}>
            <X size={18} strokeWidth={2.4} />
          </SheetClose>
        </div>
      }
      footer={
        data &&
        (melding ? (
          <button type="button" className="betal__faerdig" onClick={() => onOpenChange(false)}>
            {t('betal.faerdig')}
          </button>
        ) : (
          <>
            <Field
              className="betal__beloeb"
              variant="row"
              kind="integer"
              label={t('betal.beloeb')}
              unit={t('betal.kr')}
              form={FORM_ID}
              value={tekst}
              onChange={setBeloeb}
              placeholder="0"
              error={visibleError(tekst, kr === null ? t('betal.ugyldigt') : null)}
            />
            <SheetAction form={FORM_ID} disabled={!kanMelde} reason={handling.reason} error={fejl}>
              {kr !== null ? t('betal.knap', { beloeb: formatKr(kr) }) : t('betal.knapUdenBeloeb')}
            </SheetAction>
          </>
        ))
      }
    >
      {betal.status === 'error' && (
        <button type="button" className="betal__fejl-knap" onClick={betal.reload}>
          {rpcErrorText(betal.error)} · {t('handling.proevIgen')}
        </button>
      )}

      {data && (
        <form id={FORM_ID} onSubmit={(e) => void meld(e)}>
          <div className="betal__top">
            <span className="betal__top-label">{t('betal.duMangler')}</span>
            <span className="betal__top-beloeb">{formatKr(Math.max(data.saldo, 0))}</span>
          </div>

          {melding && <MinMeldingKort key={melding.id} melding={melding} erAdmin={erAdmin} onFortrudt={fortrudt} />}

          {data.mobilepayBox ? (
            <BoxKort nummer={data.mobilepayBox} />
          ) : (
            <div className="betal__admins">
              <span className="betal__admins-titel">{t('betal.tilAdmin')}</span>
              <ul className="betal__admins-liste">
                {data.admins.map((a) => (
                  <li key={a.id} className="betal__admin">
                    <Avatar navn={a.navn} size={36} egen={a.id === medlemId} />
                    {a.navn}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!melding &&
            (data.mobilepayBox ? (
              <ol className="betal__trin">
                <li>
                  <span className="betal__trin-nr">1</span>
                  {t('betal.trin1')}
                </li>
                <li>
                  <span className="betal__trin-nr">2</span>
                  {kr !== null ? t('betal.trin2', { beloeb: formatKr(kr) }) : t('betal.trin2UdenBeloeb')}
                </li>
                <li>
                  <span className="betal__trin-nr">3</span>
                  {t('betal.trin3')}
                </li>
              </ol>
            ) : (
              <p className="betal__note">{t('betal.tilAdminTekst')}</p>
            ))}
        </form>
      )}
    </Sheet>
  );
}

/** The MobilePay Box number with Kopiér (shows "Kopieret" for a moment). */
function BoxKort({ nummer }: { nummer: string }) {
  const [kopieret, setKopieret] = useState(false);

  useEffect(() => {
    if (!kopieret) return;
    const timer = setTimeout(() => setKopieret(false), 2000);
    return () => clearTimeout(timer);
  }, [kopieret]);

  async function kopier() {
    try {
      // Digits only, so it pastes cleanly into MobilePay.
      await navigator.clipboard.writeText(nummer.replace(/\s/g, ''));
      setKopieret(true);
    } catch {
      // No clipboard access: the number is on screen to type by hand.
    }
  }

  return (
    <div className="betal__box">
      <span className="betal__box-tekst">
        <span className="betal__box-label">{t('betal.mobilepay')}</span>
        <span className="betal__box-nummer">{nummer}</span>
      </span>
      <button type="button" className="betal__kopier" onClick={() => void kopier()}>
        {kopieret ? <Check size={18} strokeWidth={2.2} aria-hidden="true" /> : <Copy size={18} strokeWidth={2} aria-hidden="true" />}
        {t(kopieret ? 'betal.kopieret' : 'betal.kopier')}
      </button>
    </div>
  );
}
