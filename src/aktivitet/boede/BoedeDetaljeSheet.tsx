import { X } from 'lucide-react';
import { useBodekasse } from '../../bodekasse/BodekasseProvider.tsx';
import { Avatar } from '../../components/Avatar.tsx';
import { Sheet, SheetClose, SheetTitle } from '../../components/Sheet.tsx';
import { formatKr, t } from '../../strings/index.ts';
import { useHent } from '../../supabase/useHent.ts';
import { boedeTag } from '../arter/boeder.ts';
import { hentBoede, hentSenesteSaeson } from '../hentAktivitet.ts';
import { TagMaerke } from '../TagMaerke.tsx';
import { detaljeRaekker, fraTil } from './detalje.ts';
import { BOEDE_HANDLINGER } from './handlinger.ts';
import './BoedeDetaljeSheet.css';

interface BoedeDetaljeSheetProps {
  boedeId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** An action changed the Bøde. */
  onAendret: () => void;
}

/**
 * Bøde detail (partial sheet): "Fra X til Y · 5 t", name and amount, the
 * info card, then the actions in BOEDE_HANDLINGER. Use it through
 * `useBoedeDetalje().aabn(boedeId)`.
 */
export function BoedeDetaljeSheet({ boedeId, open, onOpenChange, onAendret }: BoedeDetaljeSheetProps) {
  const { medlemId, erAdmin, bodekasseId } = useBodekasse();
  const hentet = useHent(
    () => Promise.all([hentBoede(boedeId), hentSenesteSaeson(bodekasseId)]),
    [boedeId, bodekasseId],
  );
  const [boede, senesteSaeson] = hentet.status === 'ready' ? hentet.data : [null, null];
  const ctx = { migId: medlemId };
  const tag = boede ? boedeTag(boede) : undefined;

  const header = (
    <header className="boede-detalje__header">
      <div className="boede-detalje__fra">
        {boede && (
          <>
            <Avatar navn={boede.giverNavn} size={28} egen={boede.giverId === medlemId} />
            <span>{fraTil(boede, ctx)}</span>
          </>
        )}
        <SheetClose className="sheet__close boede-detalje__luk" aria-label={t('sheet.luk')}>
          <X size={16} strokeWidth={2.4} />
        </SheetClose>
      </div>
      <div className="boede-detalje__top">
        <SheetTitle className="boede-detalje__navn">{boede?.navn ?? t('boede.titel')}</SheetTitle>
        {boede && (
          <span className={`boede-detalje__beloeb${boede.annullering ? ' boede-detalje__beloeb--annulleret' : ''}`}>
            {formatKr(boede.pris)}
          </span>
        )}
      </div>
      {tag && <TagMaerke tag={tag} />}
    </header>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange} height="partial" title={t('boede.titel')} header={header}>
      {hentet.status === 'error' && (
        <button type="button" className="boede-detalje__fejl" onClick={hentet.reload}>
          {t('fejl.ukendt')}
        </button>
      )}
      {hentet.status === 'ready' && !boede && <p className="boede-detalje__fejl">{t('boede.findesIkke')}</p>}
      {boede && (
        <div className="boede-detalje">
          <dl className="boede-detalje__info">
            {detaljeRaekker(boede, ctx).map((r) => (
              <div key={r.label} className="boede-detalje__raekke">
                <dt>{r.label}</dt>
                <dd>{r.vaerdi}</dd>
              </div>
            ))}
          </dl>
          <div className="boede-detalje__handlinger">
            {BOEDE_HANDLINGER.map((Handling, i) => (
              <Handling
                key={i}
                boede={boede}
                mig={{ medlemId, erAdmin }}
                iSenesteSaeson={boede.saesonId === senesteSaeson}
                luk={() => onOpenChange(false)}
                aendret={() => {
                  hentet.reload();
                  onAendret();
                }}
              />
            ))}
          </div>
        </div>
      )}
    </Sheet>
  );
}
