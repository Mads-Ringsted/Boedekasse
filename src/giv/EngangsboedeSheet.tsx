import { useState, type FormEvent } from 'react';
import { Receipt } from 'lucide-react';
import { useBodekasse } from '../bodekasse/BodekasseProvider.tsx';
import { Avatar } from '../components/Avatar.tsx';
import { Sheet } from '../components/Sheet.tsx';
import { T } from '../components/T.tsx';
import { hentIndstillinger } from '../indstillinger/hentIndstillinger.ts';
import { parsePris } from '../kategorier/kategoriListe.ts';
import { formatKr, t } from '../strings/index.ts';
import { rpcErrorText } from '../supabase/rpcErrors.ts';
import { useHent } from '../supabase/useHent.ts';
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
 * Gebyr and that Frikøb doesn't cover it. Stacks on Giv bøder. Mount it with a
 * new `key` per opening so the fields start empty.
 */
export function EngangsboedeSheet({ open, onOpenChange, modtagere, onTilfoej }: EngangsboedeSheetProps) {
  const { bodekasseId } = useBodekasse();
  const [grund, setGrund] = useState('');
  const [beloeb, setBeloeb] = useState('');

  // The Gebyr, if the rule is on. Wait for it, so nobody pays a Gebyr they were not shown.
  const regler = useHent(() => hentIndstillinger(bodekasseId), [bodekasseId]);
  const ind = regler.status === 'ready' ? regler.data.indstillinger : null;
  const gebyr = ind?.engangsgebyr_til ? ind.engangsgebyr : null;

  const beloebTal = parsePris(beloeb);
  const kanTilfoeje = grund.trim() !== '' && beloebTal !== null && ind !== null;
  const flere = modtagere.length > 1;

  function tilfoej(event: FormEvent) {
    event.preventDefault();
    if (!kanTilfoeje) return;
    onTilfoej({ grund: grund.trim(), beloeb: beloebTal });
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      height="full"
      stacked
      title={t('giv.engangs.titel')}
      footer={
        <div className="giv__footer">
          <button type="submit" form={FORM_ID} className="giv__primaer" disabled={!kanTilfoeje}>
            {beloebTal === null
              ? t('giv.engangs.tilfoejTom')
              : t(flere ? 'giv.engangs.tilfoejHver' : 'giv.engangs.tilfoej', { beloeb: formatKr(beloebTal) })}
          </button>
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

        <label className="kategori-form__field">
          <span className="kategori-form__label">{t('giv.engangs.hvorfor')}</span>
          <span className="kategori-form__boks">
            <input
              className="kategori-form__input"
              type="text"
              value={grund}
              onChange={(e) => setGrund(e.target.value)}
              autoComplete="off"
              enterKeyHint="next"
              maxLength={MAKS_GRUND}
              autoFocus
            />
          </span>
        </label>

        <div className="engangs__beloeb">
          <span className="engangs__beloeb-label">{t('giv.engangs.beloeb')}</span>
          <label className="engangs__beloeb-felt">
            <input
              type="text"
              inputMode="numeric"
              placeholder="0"
              value={beloeb}
              onChange={(e) => setBeloeb(e.target.value)}
              aria-label={t('giv.engangs.beloebLabel')}
              autoComplete="off"
            />
            <span>{t('kategori.kr')}</span>
          </label>
          {beloeb.trim() !== '' && beloebTal === null && (
            <span className="kategori-form__hint">{t('fejl.beloebUgyldig')}</span>
          )}
        </div>

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
