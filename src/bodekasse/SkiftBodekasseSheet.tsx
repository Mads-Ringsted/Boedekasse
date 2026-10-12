import { useNavigate } from 'react-router';
import { Sheet } from '../components/Sheet.tsx';
import { t } from '../strings/index.ts';
import { BodekasseListe, KasseValg } from './BodekasseListe.tsx';
import { useBodekasse, useMedlemskaber } from './BodekasseProvider.tsx';

/** Skift Bødekasse: every box you are in, plus Opret ny and Jeg har en kode. */
export function SkiftBodekasseSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { load, switchTo } = useMedlemskaber();
  const { bodekasseId } = useBodekasse();
  const navigate = useNavigate();
  const medlemskaber = load.status === 'ready' ? load.medlemskaber : [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange} height="partial" title={t('skift.titel')}>
      <div className="skift">
        <BodekasseListe
          medlemskaber={medlemskaber}
          aabenId={bodekasseId}
          onVaelg={(id) => {
            onOpenChange(false);
            if (id === bodekasseId) return;
            void navigate('/');
            switchTo(id);
          }}
        />
        <KasseValg onValgt={() => onOpenChange(false)} />
      </div>
    </Sheet>
  );
}
