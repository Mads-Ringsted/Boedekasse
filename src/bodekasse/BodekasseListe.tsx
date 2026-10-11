import { Check, ChevronRight, KeyRound, Plus } from 'lucide-react';
import { useVisOnboarding } from '../onboarding/Onboarding.tsx';
import { forbogstav } from '../components/initialer.ts';
import { t } from '../strings/index.ts';
import { supabase } from '../supabase/index.ts';
import { useHent } from '../supabase/useHent.ts';
import type { Medlemskab } from './BodekasseProvider.tsx';
import './BodekasseListe.css';

/** Active Medlemmer per box, for every box the person is in (RLS limits it). */
async function hentAntalMedlemmer(): Promise<Map<string, number>> {
  const { data, error } = await supabase.from('medlem').select('bodekasse_id').is('udmeldt', null);
  if (error) throw error;
  const antal = new Map<string, number>();
  for (const m of data) antal.set(m.bodekasse_id, (antal.get(m.bodekasse_id) ?? 0) + 1);
  return antal;
}

interface BodekasseListeProps {
  medlemskaber: Medlemskab[];
  onVaelg: (bodekasseId: string) => void;
  /** The open box: ticked instead of a chevron. */
  aabenId?: string;
}

/** One row per box: letter tile, name and number of Medlemmer. */
export function BodekasseListe({ medlemskaber, onVaelg, aabenId }: BodekasseListeProps) {
  const antal = useHent(hentAntalMedlemmer, []);

  return (
    <ul className="kasse-liste">
      {medlemskaber.map((m, i) => {
        const n = antal.status === 'ready' ? antal.data.get(m.bodekasseId) : undefined;
        const aaben = m.bodekasseId === aabenId;
        const fremhaev = aabenId ? aaben : i === 0;
        return (
          <li key={m.bodekasseId}>
            <button
              type="button"
              className="kasse-liste__row"
              onClick={() => onVaelg(m.bodekasseId)}
              aria-current={aaben ? 'true' : undefined}
            >
              <span className={`kasse-liste__tile${fremhaev ? ' kasse-liste__tile--foerste' : ''}`} aria-hidden="true">
                {forbogstav(m.bodekasseNavn)}
              </span>
              <span className="kasse-liste__text">
                <span className="kasse-liste__navn">{m.bodekasseNavn}</span>
                <span className="kasse-liste__antal">
                  {n === undefined ? null : n === 1 ? t('vaelg.etMedlem') : t('vaelg.antalMedlemmer', { antal: n })}
                </span>
              </span>
              {aaben ? (
                <Check className="kasse-liste__check" size={20} strokeWidth={2.6} aria-label={t('vaelg.aaben')} />
              ) : (
                <ChevronRight className="kasse-liste__chevron" size={18} strokeWidth={2.2} aria-hidden="true" />
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** "Opret ny" and "Jeg har en kode", under a box list. */
export function KasseValg({ onValgt }: { onValgt?: () => void }) {
  const vis = useVisOnboarding();
  return (
    <div className="kasse-valg">
      <button
        type="button"
        className="kasse-valg__knap"
        onClick={() => {
          onValgt?.();
          vis('opret');
        }}
      >
        <Plus size={18} strokeWidth={2.4} aria-hidden="true" />
        {t('vaelg.opretNy')}
      </button>
      <button
        type="button"
        className="kasse-valg__knap"
        onClick={() => {
          onValgt?.();
          vis('kode');
        }}
      >
        <KeyRound size={18} strokeWidth={2} aria-hidden="true" />
        {t('vaelg.kode')}
      </button>
    </div>
  );
}
