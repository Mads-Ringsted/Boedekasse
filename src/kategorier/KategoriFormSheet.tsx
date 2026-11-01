import { useRef, useState, type FormEvent } from 'react';
import { Receipt } from 'lucide-react';
import { useBodekasse } from '../bodekasse/BodekasseProvider.tsx';
import { Field } from '../components/Field.tsx';
import { primaryAction, typedRequirement, visibleError } from '../components/fieldRules.ts';
import { Sheet } from '../components/Sheet.tsx';
import { SheetAction } from '../components/SheetAction.tsx';
import { T } from '../components/T.tsx';
import { hentIndstillinger } from '../indstillinger/hentIndstillinger.ts';
import { gebyrVedOprettelse } from '../indstillinger/indstillinger.ts';
import { formatKr, t } from '../strings/index.ts';
import { supabase } from '../supabase/index.ts';
import { rpcErrorText } from '../supabase/rpcErrors.ts';
import { useHent } from '../supabase/useHent.ts';
import type { Kategori } from './hentKategorier.ts';
import { parsePris } from './kategoriListe.ts';
import './Kategorier.css';

interface KategoriFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Redigér this one; without it, Ny bødekategori. */
  kategori?: Kategori;
  /** Saved; the id of the new or edited Bødekategori. */
  onSaved: (id: string) => void;
  /** Opened from another sheet (Giv bøder). */
  stacked?: boolean;
}

const FORM_ID = 'kategori-form';

/**
 * Ny bødekategori / Redigér: Navn, Pris (whole kroner) and an optional
 * Beskrivelse. Mount it with a new `key` per opening so the fields and the
 * one-time ID start fresh.
 */
export function KategoriFormSheet({ open, onOpenChange, kategori, onSaved, stacked = false }: KategoriFormSheetProps) {
  const { bodekasseId } = useBodekasse();
  const [navn, setNavn] = useState(kategori?.navn ?? '');
  const [pris, setPris] = useState(kategori ? String(kategori.pris) : '');
  const [beskrivelse, setBeskrivelse] = useState(kategori?.beskrivelse ?? '');
  const [busy, setBusy] = useState(false);
  const [fejl, setFejl] = useState<string | null>(null);
  // One ID per opening, so "Prøv igen" after a lost answer never saves twice.
  const [klientId] = useState(() => crypto.randomUUID());
  const navnFelt = useRef<HTMLInputElement>(null);
  const aendret =
    navn !== (kategori?.navn ?? '') ||
    pris !== (kategori ? String(kategori.pris) : '') ||
    beskrivelse !== (kategori?.beskrivelse ?? '');

  // Ny only: the creation Gebyr, if the rule is on. Wait for it, so nobody
  // pays a Gebyr they were not shown.
  const regler = useHent(
    () => (kategori ? Promise.resolve(null) : hentIndstillinger(bodekasseId)),
    [kategori, bodekasseId],
  );
  const gebyr =
    regler.status === 'ready' && regler.data ? gebyrVedOprettelse(regler.data.indstillinger, regler.data.pause) : null;

  const prisTal = parsePris(pris);
  const handling = primaryAction(
    [
      [navn.trim() !== '', t('aarsag.skrivNavn')],
      typedRequirement(pris, prisTal !== null, t('aarsag.skrivPris'), t('aarsag.retPris')),
      // While the rules load (or failed, which shows below), there is nothing more to say.
      [regler.status === 'ready', ''],
    ],
    { busy },
  );
  const kanGemme = handling.enabled;

  async function gem(event: FormEvent) {
    event.preventDefault();
    if (!kanGemme || prisTal === null) return;
    setBusy(true);
    setFejl(null);
    const svar = kategori
      ? await supabase.rpc('ret_bodekategori', {
          p_klient_id: klientId,
          p_bodekategori: kategori.id,
          p_navn: navn,
          p_pris: prisTal,
          p_beskrivelse: beskrivelse,
        })
      : await supabase.rpc('opret_bodekategori', {
          p_klient_id: klientId,
          p_bodekasse: bodekasseId,
          p_navn: navn,
          p_pris: prisTal,
          p_beskrivelse: beskrivelse,
        });
    setBusy(false);
    if (svar.error) {
      setFejl(rpcErrorText(svar.error));
      return;
    }
    onSaved(kategori ? kategori.id : (svar.data as { bodekategori_id: string }).bodekategori_id);
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      height="full"
      stacked={stacked}
      title={t(kategori ? 'kategori.redigerTitel' : 'kategorier.ny')}
      // A new Kategori starts with its name; editing one only opens it.
      initialFocus={kategori ? undefined : navnFelt}
      dirty={aendret}
      footer={
        <SheetAction
          form={FORM_ID}
          className="kategori-form__primary"
          disabled={!kanGemme}
          reason={handling.reason}
          error={fejl}
        >
          {kategori
            ? t('kategori.gem')
            : gebyr !== null
              ? t('kategori.opretMedGebyr', { beloeb: formatKr(gebyr) })
              : t('kategori.opret')}
        </SheetAction>
      }
    >
      <form id={FORM_ID} className="kategori-form" onSubmit={(e) => void gem(e)}>
        <Field
          ref={navnFelt}
          className="kategori-form__felt"
          label={t('kategori.navn')}
          value={navn}
          onChange={setNavn}
          enterKeyHint="next"
          maxLength={60}
        />

        <Field
          className="kategori-form__felt"
          label={t('kategori.pris')}
          kind="integer"
          unit={t('kategori.kr')}
          value={pris}
          onChange={setPris}
          enterKeyHint="next"
          error={visibleError(pris, prisTal === null ? t('kategori.prisUgyldig') : null)}
        />

        <Field
          className="kategori-form__felt"
          label={t('kategori.beskrivelse')}
          value={beskrivelse}
          onChange={setBeskrivelse}
          placeholder={t('kategori.beskrivelsePladsholder')}
          maxLength={300}
          rows={3}
        />

        {kategori && <p className="kategori-form__note">{t('kategori.redigerNote')}</p>}
        {gebyr !== null && (
          <div className="kategori-form__gebyr">
            <span className="kategori-form__gebyr-ikon" aria-hidden="true">
              <Receipt size={16} strokeWidth={2} />
            </span>
            <span>
              <T id="kategori.gebyrNote" values={{ beloeb: <strong>{formatKr(gebyr)}</strong> }} />
            </span>
          </div>
        )}
        {regler.status === 'error' && (
          <button type="button" className="kategori-form__fejl kategori-form__proev" onClick={regler.reload}>
            {rpcErrorText(regler.error)} · {t('handling.proevIgen')}
          </button>
        )}
      </form>
    </Sheet>
  );
}
