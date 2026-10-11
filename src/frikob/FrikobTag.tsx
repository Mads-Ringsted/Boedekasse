import { ShieldCheck } from 'lucide-react';
import { t } from '../strings/index.ts';
import './Frikob.css';

/** The blue Frikøb tag with a shield: "Frikøb", or e.g. "Oliver har Frikøb". */
export function FrikobTag({ tekst = t('frikob.tag') }: { tekst?: string }) {
  return (
    <span className="frikob-tag">
      <ShieldCheck size={12} strokeWidth={2.4} aria-hidden="true" />
      {tekst}
    </span>
  );
}
