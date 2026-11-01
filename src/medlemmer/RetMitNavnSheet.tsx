import { useRef, useState, type FormEvent } from 'react';
import { useBodekasse, useMedlemskaber } from '../bodekasse/BodekasseProvider.tsx';
import { Field } from '../components/Field.tsx';
import { primaryAction } from '../components/field.ts';
import { Sheet } from '../components/Sheet.tsx';
import { SheetAction } from '../components/SheetAction.tsx';
import { t } from '../strings/index.ts';
import { supabase } from '../supabase/index.ts';
import { rpcErrorText } from '../supabase/rpcErrors.ts';
import './felter.css';

const FORM_ID = 'ret-mit-navn';

/** Your own name in this box. Names are per box. */
export function RetMitNavnSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { bodekasseId, bodekasseNavn, navn: nuvaerende } = useBodekasse();
  const { reload } = useMedlemskaber();
  const [navn, setNavn] = useState(nuvaerende);
  const [busy, setBusy] = useState(false);
  const [fejl, setFejl] = useState<string | null>(null);
  const [klientId, setKlientId] = useState(() => crypto.randomUUID());
  const felt = useRef<HTMLInputElement>(null);

  const handling = primaryAction([[navn.trim() !== '', t('fejl.mitNavnMangler')]], {
    busy,
    unchanged: navn.trim() === nuvaerende,
  });
  const kanGemme = handling.enabled;

  function skift(aaben: boolean) {
    setNavn(nuvaerende);
    setFejl(null);
    setKlientId(crypto.randomUUID());
    onOpenChange(aaben);
  }

  async function gem(event: FormEvent) {
    event.preventDefault();
    if (!kanGemme) return;
    setBusy(true);
    setFejl(null);
    const { error } = await supabase.rpc('ret_mit_navn', {
      p_klient_id: klientId,
      p_bodekasse: bodekasseId,
      p_navn: navn,
    });
    if (error) {
      setBusy(false);
      setFejl(rpcErrorText(error));
      return;
    }
    // The name lives on your Medlemskab, so every screen shows the new one.
    await reload();
    setBusy(false);
    onOpenChange(false);
  }

  return (
    <Sheet
      open={open}
      onOpenChange={skift}
      height="partial"
      title={t('mitNavn.titel')}
      initialFocus={felt}
      dirty={navn !== nuvaerende}
      footer={
        <SheetAction form={FORM_ID} disabled={!kanGemme} reason={handling.reason} error={fejl}>
          {t('mitNavn.gem')}
        </SheetAction>
      }
    >
      <form id={FORM_ID} onSubmit={(e) => void gem(e)}>
        <Field
          ref={felt}
          label={t('mitNavn.label', { bodekasse: bodekasseNavn })}
          kind="name"
          value={navn}
          onChange={setNavn}
          autoComplete="name"
          note={t('mitNavn.note')}
        />
      </form>
    </Sheet>
  );
}
