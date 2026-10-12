import { useState } from 'react';
import { useBodekasse } from '../bodekasse/BodekasseProvider.tsx';
import { boedeTag } from '../aktivitet/arter/boeder.ts';
import type { Boede } from '../aktivitet/haendelse.ts';
import { ejer, hvem, hvemObjekt } from '../aktivitet/navne.ts';
import { TagMaerke } from '../aktivitet/TagMaerke.tsx';
import { Sheet } from '../components/Sheet.tsx';
import { formatKr, t } from '../strings/index.ts';
import { supabase } from '../supabase/index.ts';
import { rpcErrorText } from '../supabase/rpcErrors.ts';
import { afgoerelseValg, type Valg } from './afgoerelse.ts';
import './Afgoerelse.css';

interface AfgoerelseSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boede: Boede;
  /** Ændr afgørelse: starts on the current verdict and calls `aendr_afgoerelse`. */
  aendr?: boolean;
  /** The verdict went through (the sheet has closed). */
  onAfgjort: () => void;
}

/**
 * The verdict sheet (anke-afgoerelse.html), a partial sheet over the Bøde
 * detail: the Bøde with its tag, two radio cards ("Bøden står ved magt" /
 * "Anken vinder"), a note that the Anke Gebyr stays, and the button. Mount it
 * fresh per opening so the one-time ID is new.
 */
export function AfgoerelseSheet({ open, onOpenChange, boede, aendr = false, onAfgjort }: AfgoerelseSheetProps) {
  const { medlemId } = useBodekasse();
  const ctx = { migId: medlemId };
  const nu: Valg | null =
    aendr && (boede.afgoerelse === 'giver_vandt' || boede.afgoerelse === 'modtager_vandt') ? boede.afgoerelse : null;
  const [valgt, setValgt] = useState<Valg | null>(nu);
  const [busy, setBusy] = useState(false);
  const [fejl, setFejl] = useState<string | null>(null);
  // One ID per verdict, so "Prøv igen" never records it twice.
  const [klientId] = useState(() => crypto.randomUUID());
  const tag = boedeTag(boede);

  async function registrer() {
    if (!valgt || !boede.ankeId || busy) return;
    setBusy(true);
    setFejl(null);
    const args = { p_klient_id: klientId, p_anke: boede.ankeId, p_afgoerelse: valgt };
    const { error } = await (aendr ? supabase.rpc('aendr_afgoerelse', args) : supabase.rpc('afgoer_anke', args));
    setBusy(false);
    if (error) {
      setFejl(rpcErrorText(error));
      return;
    }
    onOpenChange(false);
    onAfgjort();
  }

  const footer = (
    <>
      {fejl && (
        <p className="afgoerelse__fejl" role="alert">
          {fejl}
        </p>
      )}
      <button
        type="button"
        className="afgoerelse__knap"
        disabled={!valgt || valgt === nu || busy}
        onClick={() => void registrer()}
      >
        {t(aendr ? 'afgoerelse.aendrKnap' : 'afgoerelse.knap')}
      </button>
    </>
  );

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      height="partial"
      title={t(aendr ? 'afgoerelse.aendrTitel' : 'afgoerelse.titel')}
      footer={footer}
    >
      <div className="afgoerelse">
        <div className="afgoerelse__boede">
          <span className="afgoerelse__hvem">
            {tag && <TagMaerke tag={tag} />}
            {t('afgoerelse.anker', {
              hvem: hvem(boede.modtagerId, boede.modtagerNavn, ctx),
              ejer: ejer(boede.giverId, boede.giverNavn, boede.modtagerId, ctx, 'n'),
            })}
          </span>
          <span className="afgoerelse__linje">
            <span className="afgoerelse__navn">{boede.navn}</span>
            <span className="afgoerelse__beloeb">{formatKr(boede.pris)}</span>
          </span>
        </div>

        <div role="radiogroup" aria-label={t('afgoerelse.valg')} className="afgoerelse__valg">
          {afgoerelseValg(boede, ctx).map((v) => {
            const tjekket = v.afgoerelse === valgt;
            return (
              <button
                key={v.afgoerelse}
                type="button"
                role="radio"
                aria-checked={tjekket}
                className={`afgoerelse__kort${tjekket ? ' afgoerelse__kort--valgt' : ''}`}
                onClick={() => setValgt(v.afgoerelse)}
              >
                <span className="afgoerelse__radio" aria-hidden="true" />
                <span className="afgoerelse__tekst">
                  <span className="afgoerelse__titel">{v.titel}</span>
                  <span className="afgoerelse__under">{v.tekst}</span>
                </span>
              </button>
            );
          })}
        </div>

        {boede.ankeGebyr !== null && (
          <p className="afgoerelse__note">
            {t('afgoerelse.gebyrNote', {
              beloeb: formatKr(boede.ankeGebyr),
              // The subject after the verb: "betaler Emil" / "betaler du".
              hvem:
                boede.modtagerId === medlemId
                  ? t('aktivitet.du').toLocaleLowerCase('da')
                  : hvemObjekt(boede.modtagerId, boede.modtagerNavn, ctx),
            })}
          </p>
        )}
      </div>
    </Sheet>
  );
}
