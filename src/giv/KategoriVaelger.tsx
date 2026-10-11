import { useState, type ReactNode } from 'react';
import { Minus, Plus, Search } from 'lucide-react';
import type { Kategori } from '../kategorier/hentKategorier.ts';
import { formatKr, t } from '../strings/index.ts';
import { MAKS_ANTAL, type Engangsbode } from './valg.ts';

interface KategoriVaelgerProps {
  /** Active Bødekategorier in list order ("Ofte brugt" first). */
  kategorier: readonly Kategori[];
  /** The count a row's stepper shows. */
  antal: (kategoriId: string) => number;
  onPlus: (kategoriId: string) => void;
  onMinus: (kategoriId: string) => void;
  /** Shows "Ny bødekategori" at the end of the list. */
  onNy?: () => void;
  /** Shows "Engangsbøde" at the very end of the list (#58). */
  onEngangs?: () => void;
  /** Engangsbøder already added, listed after the Bødekategorier with a remove button. */
  engangs?: readonly Engangsbode[];
  onFjernEngangs?: (id: string) => void;
  /** An extra line under a row's price (#65: "Gives kun til Jonas"). */
  note?: (kategori: Kategori) => ReactNode;
  /** A tag next to a row's price (#65: "Oliver har Frikøb"). Defaults to "Ofte brugt". */
  tag?: (kategori: Kategori) => ReactNode;
  /** Greys a row out so it can't be tapped (#65: bought out in 3b). */
  deaktiveret?: (kategori: Kategori) => boolean;
}

/** Search plus the one list of Bødekategorier with + and − / count / + steppers. */
export function KategoriVaelger({
  kategorier,
  antal,
  onPlus,
  onMinus,
  onNy,
  onEngangs,
  engangs = [],
  onFjernEngangs,
  note,
  tag,
  deaktiveret,
}: KategoriVaelgerProps) {
  const [soeg, setSoeg] = useState('');
  const ord = soeg.trim().toLocaleLowerCase('da');
  const viste = ord ? kategorier.filter((k) => k.navn.toLocaleLowerCase('da').includes(ord)) : kategorier;

  return (
    <>
      <label className="giv-soeg">
        <Search size={18} strokeWidth={2} aria-hidden="true" />
        <input
          type="search"
          aria-label={t('giv.soeg')}
          placeholder={t('giv.soeg')}
          value={soeg}
          onChange={(e) => setSoeg(e.target.value)}
        />
      </label>

      <ul className="giv-kat-liste">
        {viste.map((k) => {
          const n = antal(k.id);
          const slukket = deaktiveret?.(k) ?? false;
          return (
            <li key={k.id} className={`giv-kat${n > 0 ? ' giv-kat--valgt' : ''}${slukket ? ' giv-kat--slukket' : ''}`}>
              <span className="giv-kat__tekst">
                <span className="giv-kat__navn">{k.navn}</span>
                <span className="giv-kat__meta">
                  {formatKr(k.pris)}
                  {tag ? tag(k) : k.ofteBrugt && <span className="kategori-tag">{t('kategorier.ofteBrugt')}</span>}
                </span>
                {note?.(k)}
              </span>
              {n > 0 ? (
                <span className="giv-kat__stepper">
                  <button
                    type="button"
                    className="giv-kat__knap"
                    aria-label={t('giv.enFaerre')}
                    onClick={() => onMinus(k.id)}
                  >
                    <Minus size={18} strokeWidth={2.4} aria-hidden="true" />
                  </button>
                  <span className="giv-kat__antal" aria-live="polite">
                    {n}
                  </span>
                  <button
                    type="button"
                    className="giv-kat__knap giv-kat__knap--plus"
                    aria-label={t('giv.enMere')}
                    disabled={slukket || n >= MAKS_ANTAL}
                    onClick={() => onPlus(k.id)}
                  >
                    <Plus size={18} strokeWidth={2.4} aria-hidden="true" />
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  className="giv-kat__knap"
                  aria-label={t('giv.tilfoejKategori', { navn: k.navn })}
                  disabled={slukket}
                  onClick={() => onPlus(k.id)}
                >
                  <Plus size={18} strokeWidth={2.4} aria-hidden="true" />
                </button>
              )}
            </li>
          );
        })}
        {viste.length === 0 && (
          <li className="giv-kat giv-kat--tom">
            {kategorier.length === 0 ? t('giv.ingenKategorier') : t('kategorier.ingenFundet')}
          </li>
        )}
        {engangs.map((e) => (
          <li key={e.id} className="giv-kat giv-kat--valgt">
            <span className="giv-kat__tekst">
              <span className="giv-kat__navn">{e.grund}</span>
              <span className="giv-kat__meta">
                {formatKr(e.beloeb)}
                <span className="kategori-tag kategori-tag--graa">{t('giv.engangs.tag')}</span>
              </span>
            </span>
            {onFjernEngangs && (
              <button
                type="button"
                className="giv-kat__knap"
                aria-label={t('giv.engangs.fjern', { grund: e.grund })}
                onClick={() => onFjernEngangs(e.id)}
              >
                <Minus size={18} strokeWidth={2.4} aria-hidden="true" />
              </button>
            )}
          </li>
        ))}
        {onNy && (
          <li>
            <button type="button" className="giv-kat__ny" onClick={onNy}>
              <Plus size={18} strokeWidth={2.4} aria-hidden="true" />
              {t('giv.nyKategori')}
            </button>
          </li>
        )}
        {onEngangs && (
          <li>
            <button type="button" className="giv-kat__ny" onClick={onEngangs}>
              <Plus size={18} strokeWidth={2.4} aria-hidden="true" />
              {t('giv.engangs.titel')}
            </button>
          </li>
        )}
      </ul>
    </>
  );
}
