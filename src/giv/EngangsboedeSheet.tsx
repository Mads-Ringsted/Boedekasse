import { useRef, useState, type FormEvent } from 'react';
import { Receipt } from 'lucide-react';
import { useBodekasse } from '../bodekasse/BodekasseProvider.tsx';
import { Avatar } from '../components/Avatar.tsx';
import { Field } from '../components/Field.tsx';
import { primaryAction, typedRequirement, visibleError } from '../components/fieldRules.ts';
import { Sheet } from '../components/Sheet.tsx';
import { SheetAction } from '../components/SheetAction.tsx';
import { T } from '../components/T.tsx';
import { hentIndstillinger } from '../indstillinger/hentIndstillinger.ts';
import { formatKr, t } from '../strings/index.ts';
import { rpcErrorText } from '../supabase/rpcErrors.ts';
import { useHent } from '../supabase/useHent.ts';
import { begraensBeloeb, engangsBeloeb, engangsPris } from './engangsPris.ts';
import type { Modtager } from './hentGiv.ts';
import { navneliste } from './tekst.ts';
import '../kategorier/Kategorier.css';
import './GivBoeder.css';

interface EngangsboedeSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Who gets it: everyone picked (step 2) or one person (3b). */
  modtagere: readonly Modtager[];
  /** Tilføj: adds it to the selection; it is given with the rest of the batch. */
  onTilfoej: (engangsbode: { grund: string; beloeb: number }) => void;
}

const FORM_ID = 'engangsboede-form';
/** The server's limit (grund_for_lang). */
const MAKS_GRUND = 100;

/**
 * Engangsbøde: who, Hvorfor, a large amount, and a note about the giver's
 * Gebyr and that Frikøb doesn't cover it. The amount follows the box's price
 * mode (#76): typed in Fri, fixed with no field in Fast, typed up to the cap
 * in Loft. Stacks on Giv bøder. Mount it with a
 * new `key` per opening so the fields start empty.
 */
export function EngangsboedeSheet({ open, onOpenChange, modtagere, onTilfoej }: EngangsboedeSheetProps) {
  const { bodekasseId } = useBodekasse();
  const [grund, setGrund] = useState('');
  const [beloeb, setBeloeb] = useState('');
  const grundFelt = useRef<HTMLInputElement>(null);

  // The Gebyr, if the rule is on. Wait for it, so nobody pays a Gebyr they were not shown.
  const regler = useHent(() => hentIndstillinger(bodekasseId), [bodekasseId]);
  const ind = regler.status === 'ready' ? regler.data.indstillinger : null;
  const gebyr = ind?.engangsgebyr_til ? ind.engangsgebyr : null;
  const pris = ind ? engangsPris(ind) : ({ mode: 'fri' } as const);

  const beloebTal = engangsBeloeb(pris, beloeb);
  const handling = primaryAction([
    [grund.trim() !== '', t('aarsag.skrivGrund')],
    typedRequirement(beloeb, beloebTal !== null, t('aarsag.skrivBeloeb'), t('aarsag.retBeloeb')),
    // While the rules load (or failed, which shows below), there is nothing more to say.
    [ind !== null, ''],
  ]);
  const flere = modtagere.length > 1;

  function tilfoej(event: FormEvent) {
    event.preventDefault();
    if (!handling.enabled || beloebTal === null) return;
    onTilfoej({ grund: grund.trim(), beloeb: beloebTal });
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      height="full"
      stacked
      title={t('giv.engangs.titel')}
      initialFocus={grundFelt}
      dirty={grund !== '' || beloeb !== ''}
      footer={
        <div className="giv__footer">
          <SheetAction form={FORM_ID} className="giv__primaer" disabled={!handling.enabled} reason={handling.reason}>
            {beloebTal === null
              ? t('giv.engangs.tilfoejTom')
              : t(flere ? 'giv.engangs.tilfoejHver' : 'giv.engangs.tilfoej', { beloeb: formatKr(beloebTal) })}
          </SheetAction>
        </div>
      }
    >
      <form id={FORM_ID} className="engangs" onSubmit={tilfoej}>
        <div className="engangs__til">
          <span className="giv__stak" aria-hidden="true">
            {modtagere.slice(0, 4).map((m) => (
              <Avatar key={m.id} navn={m.navn} size={32} stiplet={!m.loggetInd} />
            ))}
          </span>
          <span>
            <T
              id="giv.engangs.til"
              values={{ navne: <strong key="n">{navneliste(modtagere.map((m) => m.kortNavn))}</strong> }}
            />
          </span>
        </div>

        <Field
          ref={grundFelt}
          className="engangs__felt"
          label={t('giv.engangs.hvorfor')}
          value={grund}
          onChange={setGrund}
          enterKeyHint={pris.mode === 'fast' ? 'done' : 'next'}
          maxLength={MAKS_GRUND}
        />

        {pris.mode === 'fast' ? (
          <div className="engangs__beloeb">
            <span className="engangs__beloeb-label">{t('giv.engangs.beloeb')}</span>
            <span className="engangs__beloeb-felt">
              <span className="engangs__beloeb-fast">{pris.beloeb}</span>
              <span>{t('kategori.kr')}</span>
            </span>
            <span className="engangs__beloeb-note">{t('giv.engangs.fast')}</span>
          </div>
        ) : (
          <Field
            className="engangs__beloeb"
            variant="amount"
            kind="integer"
            label={t('giv.engangs.beloeb')}
            unit={t('kategori.kr')}
            placeholder="0"
            value={beloeb}
            onChange={(ny) => setBeloeb((forrige) => begraensBeloeb(pris, forrige, ny))}
            error={visibleError(beloeb, beloebTal === null ? t('fejl.beloebUgyldig') : null)}
            note={pris.mode === 'loft' ? t('giv.engangs.loft', { beloeb: formatKr(pris.loft) }) : null}
          />
        )}

        {ind && (
          <div className="kategori-form__gebyr">
            <span className="kategori-form__gebyr-ikon" aria-hidden="true">
              <Receipt size={16} strokeWidth={2} />
            </span>
            <span>
              {gebyr === null ? (
                t('giv.engangs.udenGebyr')
              ) : (
                <T
                  id={flere ? 'giv.engangs.gebyrHver' : 'giv.engangs.gebyr'}
                  values={{ beloeb: <strong key="b">{formatKr(gebyr)}</strong> }}
                />
              )}
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
