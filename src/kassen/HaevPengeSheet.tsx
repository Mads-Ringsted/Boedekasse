import { useState, type FormEvent } from 'react';
import { useBodekasse } from '../bodekasse/BodekasseProvider.tsx';
import { Sheet } from '../components/Sheet.tsx';
import { formatKr, t } from '../strings/index.ts';
import { supabase } from '../supabase/index.ts';
import { rpcErrorText } from '../supabase/rpcErrors.ts';
import { haevTjek } from './kassen.ts';
import '../medlemmer/felter.css';
import './Kassen.css';

interface HaevPengeSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** I bødekassen right now, in kr: the most the Admin can take out. */
  kassen: number;
  onHaevet: () => void;
}

const FORM_ID = 'haev-penge';

/**
 * Hæv penge (Admin): the box amount on top, the amount ("Højst X kr"), a
 * required purpose, and a note that no Saldo changes. The RPC checks the
 * limit again with the box locked.
 * Mount with a fresh `key` per opening so the one-time ID is new.
 */
export function HaevPengeSheet({ open, onOpenChange, kassen, onHaevet }: HaevPengeSheetProps) {
  const { bodekasseId } = useBodekasse();
  const [beloeb, setBeloeb] = useState('');
  const [formaal, setFormaal] = useState('');
  const [busy, setBusy] = useState(false);
  const [fejl, setFejl] = useState<string | null>(null);
  // One ID per Hævning, so "Prøv igen" never takes the money out twice.
  const [klientId] = useState(() => crypto.randomUUID());
  const { kr, overKassen, klar } = haevTjek(beloeb, formaal, kassen);
  const ugyldigt = beloeb !== '' && kr === null;

  async function haev(event: FormEvent) {
    event.preventDefault();
    if (!klar || kr === null || busy) return;
    setBusy(true);
    setFejl(null);
    const { error } = await supabase.rpc('haev', {
      p_klient_id: klientId,
      p_bodekasse: bodekasseId,
      p_beloeb: kr,
      p_formaal: formaal,
    });
    setBusy(false);
    if (error) {
      setFejl(rpcErrorText(error));
      return;
    }
    onOpenChange(false);
    onHaevet();
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      height="full"
      title={t('haev.titel')}
      footer={
        <button type="submit" form={FORM_ID} className="felt-knap" disabled={!klar || busy}>
          {kr !== null ? t('haev.knap', { beloeb: formatKr(kr) }) : t('haev.knapUdenBeloeb')}
        </button>
      }
    >
      <form id={FORM_ID} onSubmit={(e) => void haev(e)}>
        <div className="haev__kassen">
          <span className="haev__kassen-label">{t('hjem.iBoedekassen')}</span>
          <span className="haev__kassen-beloeb">{formatKr(kassen)}</span>
        </div>

        <div className="registrer__beloeb">
          <span className="registrer__beloeb-label">{t('registrer.beloeb')}</span>
          <label className="registrer__beloeb-felt">
            <input
              className="registrer__beloeb-input"
              type="text"
              inputMode="numeric"
              value={beloeb}
              onChange={(e) => setBeloeb(e.target.value)}
              placeholder="0"
              aria-label={t('registrer.beloebLabel')}
              aria-invalid={ugyldigt || overKassen}
              // As wide as its digits, so "300 kr" stays centred.
              style={{ width: `${Math.max(beloeb.length, 1) + 0.4}ch` }}
              autoComplete="off"
              autoFocus
            />
            <span className="registrer__kr">{t('registrer.kr')}</span>
          </label>
          <span className={`registrer__beloeb-note${overKassen ? ' haev__over' : ''}`}>
            {ugyldigt
              ? t('registrer.ugyldigt')
              : kassen <= 0
                ? t('haev.tom')
                : t('haev.hoejst', { beloeb: formatKr(kassen) })}
          </span>
        </div>

        <label className="felt haev__formaal">
          <span className="felt__label">{t('haev.formaal')}</span>
          <input
            className="felt__input"
            type="text"
            value={formaal}
            onChange={(e) => setFormaal(e.target.value)}
            placeholder={t('haev.formaalEksempel')}
            required
            enterKeyHint="done"
          />
        </label>
        <p className="felt-note">{t('haev.info')}</p>

        {fejl && (
          <p className="felt-fejl" role="alert">
            {fejl}
          </p>
        )}
      </form>
    </Sheet>
  );
}
