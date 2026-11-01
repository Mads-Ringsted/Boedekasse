import { useRef, useState, type FormEvent } from 'react';
import { useBodekasse } from '../bodekasse/BodekasseProvider.tsx';
import { Field } from '../components/Field.tsx';
import { primaryAction, typedRequirement } from '../components/fieldRules.ts';
import { Sheet } from '../components/Sheet.tsx';
import { SheetAction } from '../components/SheetAction.tsx';
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
  const beloebFelt = useRef<HTMLInputElement>(null);
  const { kr, overKassen } = haevTjek(beloeb, formaal, kassen);
  const ugyldigt = beloeb.trim() !== '' && kr === null;
  const handling = primaryAction(
    [
      typedRequirement(beloeb, kr !== null && !overKassen, t('aarsag.skrivBeloeb'), t('aarsag.retBeloeb')),
      [formaal.trim() !== '', t('fejl.formaalMangler')],
    ],
    { busy },
  );
  const hoejst = kassen <= 0 ? t('haev.tom') : t('haev.hoejst', { beloeb: formatKr(kassen) });

  async function haev(event: FormEvent) {
    event.preventDefault();
    if (!handling.enabled || kr === null) return;
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
      initialFocus={beloebFelt}
      dirty={beloeb !== '' || formaal !== ''}
      footer={
        <SheetAction form={FORM_ID} disabled={!handling.enabled} reason={handling.reason} error={fejl}>
          {kr !== null ? t('haev.knap', { beloeb: formatKr(kr) }) : t('haev.knapUdenBeloeb')}
        </SheetAction>
      }
    >
      <form id={FORM_ID} onSubmit={(e) => void haev(e)}>
        <div className="haev__kassen">
          <span className="haev__kassen-label">{t('hjem.iBoedekassen')}</span>
          <span className="haev__kassen-beloeb">{formatKr(kassen)}</span>
        </div>

        <Field
          ref={beloebFelt}
          variant="amount"
          kind="integer"
          label={t('registrer.beloeb')}
          unit={t('registrer.kr')}
          value={beloeb}
          onChange={setBeloeb}
          placeholder="0"
          enterKeyHint="next"
          error={ugyldigt ? t('registrer.ugyldigt') : overKassen ? hoejst : null}
          note={ugyldigt || overKassen ? null : hoejst}
        />

        <Field
          className="haev__formaal"
          label={t('haev.formaal')}
          value={formaal}
          onChange={setFormaal}
          placeholder={t('haev.formaalEksempel')}
          required
          note={t('haev.info')}
        />
      </form>
    </Sheet>
  );
}
