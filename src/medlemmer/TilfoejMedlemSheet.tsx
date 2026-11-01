import { useState, type FormEvent } from 'react';
import { fornavn } from '../giv/navne.ts';
import { looksLikeEmail, normalizeEmail } from '../auth/input.ts';
import { useBodekasse } from '../bodekasse/BodekasseProvider.tsx';
import { delInvitation } from '../bodekasse/delInvitation.ts';
import { Avatar } from '../components/Avatar.tsx';
import { Field } from '../components/Field.tsx';
import { primaryAction, typedRequirement } from '../components/fieldRules.ts';
import { Sheet } from '../components/Sheet.tsx';
import { SheetAction } from '../components/SheetAction.tsx';
import { t } from '../strings/index.ts';
import { supabase } from '../supabase/index.ts';
import { rpcErrorText } from '../supabase/rpcErrors.ts';
import './felter.css';

interface TilfoejMedlemSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The join code, shown as the alternative. */
  kode: string | null;
  onTilfoejet: () => void;
}

const FORM_ID = 'tilfoej-medlem';

/** Tilføj Medlem (Admin): name and email. They can get Bøder before they log in. */
export function TilfoejMedlemSheet({ open, onOpenChange, kode, onTilfoejet }: TilfoejMedlemSheetProps) {
  const { bodekasseId, bodekasseNavn } = useBodekasse();
  const [navn, setNavn] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [fejl, setFejl] = useState<string | null>(null);
  const [kopieret, setKopieret] = useState(false);
  // One ID per Medlem being added, so "Prøv igen" never adds them twice.
  const [klientId, setKlientId] = useState(() => crypto.randomUUID());

  const fornavnet = fornavn(navn);
  const handling = primaryAction(
    [
      [navn.trim() !== '', t('aarsag.skrivNavn')],
      typedRequirement(email, looksLikeEmail(email), t('aarsag.skrivEmail'), t('aarsag.retEmail')),
    ],
    { busy },
  );
  const kanTilfoeje = handling.enabled;

  function skift(aaben: boolean) {
    if (!aaben) {
      setNavn('');
      setEmail('');
      setFejl(null);
      setKopieret(false);
      setKlientId(crypto.randomUUID());
    }
    onOpenChange(aaben);
  }

  async function tilfoej(event: FormEvent) {
    event.preventDefault();
    if (!kanTilfoeje) return;
    setBusy(true);
    setFejl(null);
    const { error } = await supabase.rpc('tilfoej_medlem', {
      p_klient_id: klientId,
      p_bodekasse: bodekasseId,
      p_navn: navn,
      p_email: normalizeEmail(email),
    });
    setBusy(false);
    if (error) {
      setFejl(rpcErrorText(error));
      return;
    }
    skift(false);
    onTilfoejet();
  }

  return (
    <Sheet
      open={open}
      onOpenChange={skift}
      height="full"
      title={t('tilfoej.titel')}
      dirty={navn !== '' || email !== ''}
      footer={
        <SheetAction form={FORM_ID} disabled={!kanTilfoeje} reason={handling.reason} error={fejl}>
          {fornavnet ? t('tilfoej.knap', { navn: fornavnet }) : t('tilfoej.knapUdenNavn')}
        </SheetAction>
      }
    >
      <form id={FORM_ID} onSubmit={(e) => void tilfoej(e)}>
        <div className="tilfoej__avatar">
          <Avatar navn={navn} size={72} stiplet />
        </div>

        <Field label={t('tilfoej.navn')} kind="name" value={navn} onChange={setNavn} enterKeyHint="next" />

        <Field
          label={t('tilfoej.email')}
          kind="email"
          value={email}
          onChange={setEmail}
          placeholder={t('tilfoej.emailEksempel')}
          note={fornavnet ? t('tilfoej.note', { navn: fornavnet }) : t('tilfoej.noteUdenNavn')}
        />
      </form>

      {kode && (
        <div className="tilfoej__kode">
          <span className="join-kode__tekst">
            <span className="join-kode__label">{kopieret ? t('invitation.kopieret') : t('tilfoej.ellerKode')}</span>
            <span className="join-kode__kode">{kode}</span>
          </span>
          <button
            type="button"
            className="join-kode__del"
            onClick={() => void delInvitation(bodekasseNavn, kode).then((r) => setKopieret(r === 'kopieret'))}
          >
            {t('medlemmer.del')}
          </button>
        </div>
      )}
    </Sheet>
  );
}
