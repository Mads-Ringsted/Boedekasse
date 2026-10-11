import { useEffect, useState } from 'react';
import { Plus, Search, Tag } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router';
import { useBodekasse } from '../bodekasse/BodekasseProvider.tsx';
import { useGivBoeder } from '../giv/GivBoederProvider.tsx';
import { Screen } from '../components/Screen.tsx';
import { formatKr, t } from '../strings/index.ts';
import { useHent } from '../supabase/useHent.ts';
import { hentKategorier, type Kategori } from './hentKategorier.ts';
import { KategoriDetaljeSheet } from './KategoriDetaljeSheet.tsx';
import { KategoriFormSheet } from './KategoriFormSheet.tsx';
import { kategoriListe, type Sortering } from './kategoriListe.ts';
import './Kategorier.css';

/** Navigate here with this state to open Ny bødekategori at once (Hjem's "Kom i gang"). */
export const AABN_NY = { ny: true } as const;

type Form = { kategori?: Kategori };

/**
 * The Kategorier tab: search, Navn/Pris sort, "Ofte brugt" on the top 5 this
 * Sæson, archived ones in a small line at the bottom. Tapping a row opens
 * its detail sheet; + opens Ny bødekategori.
 */
export function Kategorier() {
  const { bodekasseId } = useBodekasse();
  const location = useLocation();
  const navigate = useNavigate();
  // Reload after Bøder are given or undone: use counts and "Ofte brugt" change.
  const { version } = useGivBoeder();
  const hentet = useHent(() => hentKategorier(bodekasseId), [bodekasseId, version]);
  const alle = hentet.status === 'ready' ? hentet.data : null;

  const [soeg, setSoeg] = useState('');
  const [sortering, setSortering] = useState<Sortering>('navn');
  const [visArkiverede, setVisArkiverede] = useState(false);

  // Each opening gets a new key, so its fields and one-time ID start fresh;
  // the last one stays mounted while it animates closed.
  const [formNr, setFormNr] = useState(0);
  const [detaljeNr, setDetaljeNr] = useState(0);
  const [form, setForm] = useState<Form | null>(null);
  const [formAaben, setFormAaben] = useState(false);
  const [valgtId, setValgtId] = useState<string | null>(null);
  const [detaljeAaben, setDetaljeAaben] = useState(false);

  function aabnForm(f: Form) {
    setFormNr((n) => n + 1);
    setForm(f);
    setFormAaben(true);
  }
  function aabnDetalje(id: string) {
    setDetaljeNr((n) => n + 1);
    setValgtId(id);
    setDetaljeAaben(true);
  }

  const kommerFraHjem = (location.state as typeof AABN_NY | null)?.ny === true;
  useEffect(() => {
    if (!kommerFraHjem) return;
    aabnForm({});
    void navigate('.', { replace: true, state: null });
  }, [kommerFraHjem, navigate]);

  const valgt = alle?.find((k) => k.id === valgtId) ?? null;
  const { aktive, arkiverede } = kategoriListe(alle ?? [], { soeg, sortering });
  const ingenEndnu = alle !== null && alle.length === 0;

  return (
    <Screen>
      <div className="kategorier__top">
        <h1 className="screen__title">{t('skaerm.kategorier')}</h1>
        <button type="button" className="kategorier__ny" aria-label={t('kategorier.ny')} onClick={() => aabnForm({})}>
          <Plus size={22} strokeWidth={2.4} aria-hidden="true" />
        </button>
      </div>

      {hentet.status === 'error' && (
        <button type="button" className="kategorier__fejl" onClick={hentet.reload}>
          {t('fejl.ukendt')}
        </button>
      )}

      {ingenEndnu && (
        <div className="kategorier__tom">
          <span className="kategorier__tom-ikon" aria-hidden="true">
            <Tag size={32} strokeWidth={2} />
          </span>
          <span className="kategorier__tom-titel">{t('kategorier.tomTitel')}</span>
          <span className="kategorier__tom-tekst">{t('kategorier.tomTekst')}</span>
          <button type="button" className="kategorier__tom-knap" onClick={() => aabnForm({})}>
            <Plus size={20} strokeWidth={2.4} aria-hidden="true" />
            {t('kategorier.ny')}
          </button>
        </div>
      )}

      {alle && !ingenEndnu && (
        <>
          <label className="kategorier__soeg">
            <Search size={18} strokeWidth={2} aria-hidden="true" />
            <input
              type="search"
              aria-label={t('kategorier.soegLabel')}
              placeholder={t('kategorier.soeg')}
              value={soeg}
              onChange={(e) => setSoeg(e.target.value)}
            />
          </label>

          <div className="kategorier__meta">
            <span className="kategorier__antal">
              {aktive.length === 1 ? t('kategorier.antalEn') : t('kategorier.antal', { antal: aktive.length })}
            </span>
            <div role="group" aria-label={t('kategorier.sorter')} className="kategorier__sortering">
              {(['navn', 'pris'] as const).map((s) => (
                <button key={s} type="button" aria-pressed={sortering === s} onClick={() => setSortering(s)}>
                  {t(s === 'navn' ? 'kategorier.sorterNavn' : 'kategorier.sorterPris')}
                </button>
              ))}
            </div>
          </div>

          {aktive.length > 0 ? (
            <KategoriRaekker kategorier={aktive} onVaelg={aabnDetalje} />
          ) : (
            <p className="kategorier__ingen">{t('kategorier.ingenFundet')}</p>
          )}

          {arkiverede.length > 0 && (
            <>
              <button
                type="button"
                className="kategorier__arkiverede"
                aria-expanded={visArkiverede}
                onClick={() => setVisArkiverede((v) => !v)}
              >
                {arkiverede.length === 1
                  ? t('kategorier.arkiveredeEn')
                  : t('kategorier.arkiverede', { antal: arkiverede.length })}
              </button>
              {visArkiverede && <KategoriRaekker kategorier={arkiverede} onVaelg={aabnDetalje} arkiveret />}
            </>
          )}
        </>
      )}

      {form && (
        <KategoriFormSheet
          key={`form-${formNr}`}
          open={formAaben}
          onOpenChange={setFormAaben}
          kategori={form.kategori}
          onSaved={(id) => {
            setFormAaben(false);
            hentet.reload();
            // After Redigér, back to its detail sheet with the new values.
            if (form.kategori) aabnDetalje(id);
          }}
        />
      )}

      {valgt && (
        <KategoriDetaljeSheet
          key={`detalje-${detaljeNr}`}
          open={detaljeAaben}
          onOpenChange={setDetaljeAaben}
          kategori={valgt}
          onRediger={() => {
            setDetaljeAaben(false);
            aabnForm({ kategori: valgt });
          }}
          onAendret={() => {
            setDetaljeAaben(false);
            hentet.reload();
          }}
        />
      )}
    </Screen>
  );
}

function KategoriRaekker({
  kategorier,
  onVaelg,
  arkiveret = false,
}: {
  kategorier: Kategori[];
  onVaelg: (id: string) => void;
  arkiveret?: boolean;
}) {
  return (
    <ul className={`kategorier__liste${arkiveret ? ' kategorier__liste--arkiveret' : ''}`}>
      {kategorier.map((k) => (
        <li key={k.id}>
          <button type="button" className="kategorier__raekke" onClick={() => onVaelg(k.id)}>
            <span className="kategorier__raekke-tekst">
              <span className="kategorier__navn">{k.navn}</span>
              <span className="kategorier__brugt">
                {k.antal === 0
                  ? t('kategorier.brugtIngen')
                  : k.antal === 1
                    ? t('kategorier.brugtEn')
                    : t('kategorier.brugt', { antal: k.antal })}
                {k.ofteBrugt && !arkiveret && <span className="kategori-tag">{t('kategorier.ofteBrugt')}</span>}
              </span>
            </span>
            <span className="kategorier__pris">{formatKr(k.pris)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
