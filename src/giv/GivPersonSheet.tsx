import { Avatar } from '../components/Avatar.tsx';
import { Sheet, SheetTitle } from '../components/Sheet.tsx';
import { T } from '../components/T.tsx';
import type { Kategori } from '../kategorier/hentKategorier.ts';
import { formatKr, t } from '../strings/index.ts';
import type { Modtager } from './hentGiv.ts';
import { KategoriVaelger } from './KategoriVaelger.tsx';
import { boederTekst } from './tekst.ts';
import type { Engangsbode } from './valg.ts';

interface GivPersonSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modtager: Modtager;
  kategorier: readonly Kategori[];
  antal: (kategoriId: string) => number;
  onPlus: (kategoriId: string) => void;
  onMinus: (kategoriId: string) => void;
  /** This person's Engangsbøder, and adding or removing one for them only. */
  engangs: readonly Engangsbode[];
  onEngangs: () => void;
  onFjernEngangs: (id: string) => void;
  /** This person's totals so far. */
  sum: { antal: number; beloeb: number };
}

/** Giv bøder step 3b: the same list, for one person only. Stacks on the flow. */
export function GivPersonSheet({
  open,
  onOpenChange,
  modtager,
  kategorier,
  antal,
  onPlus,
  onMinus,
  engangs,
  onEngangs,
  onFjernEngangs,
  sum,
}: GivPersonSheetProps) {
  const luk = () => onOpenChange(false);
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      height="full"
      stacked
      title={modtager.kortNavn}
      header={
        <header className="giv-person__header">
          <span className="giv-person__hvem">
            <Avatar navn={modtager.navn} stiplet={!modtager.loggetInd} />
            <span className="giv-person__navne">
              <span className="giv-person__kun">{t('giv.kunTil')}</span>
              <SheetTitle className="giv-person__navn">{modtager.kortNavn}</SheetTitle>
            </span>
          </span>
          <button type="button" className="giv-person__faerdig" onClick={luk}>
            {t('giv.faerdig')}
          </button>
        </header>
      }
      footer={
        <div className="giv__footer">
          <div className="giv__opsummering">
            <T
              id="giv.personSum"
              values={{
                navn: <strong key="n">{modtager.kortNavn}</strong>,
                boeder: boederTekst(sum.antal),
                beloeb: formatKr(sum.beloeb),
              }}
            />
          </div>
          <button type="button" className="giv__primaer" onClick={luk}>
            {t('giv.faerdig')}
          </button>
        </div>
      }
    >
      <KategoriVaelger
        kategorier={kategorier}
        antal={antal}
        onPlus={onPlus}
        onMinus={onMinus}
        engangs={engangs}
        onEngangs={onEngangs}
        onFjernEngangs={onFjernEngangs}
      />
    </Sheet>
  );
}
