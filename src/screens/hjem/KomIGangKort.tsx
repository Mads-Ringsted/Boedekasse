import { useState } from 'react';
import { Check } from 'lucide-react';
import { useNavigate } from 'react-router';
import { delInvitation } from '../../bodekasse/delInvitation.ts';
import { formatKr, t } from '../../strings/index.ts';
import type { KomIGangPunkt } from './komIGang.ts';

interface KomIGangKortProps {
  punkter: KomIGangPunkt[];
  bodekasseNavn: string;
  /** The join code, for Admins only. */
  kode: string | null;
}

/** The "Kom i gang" checklist on a new box's Hjem. */
export function KomIGangKort({ punkter, bodekasseNavn, kode }: KomIGangKortProps) {
  const navigate = useNavigate();
  const [kopieret, setKopieret] = useState(false);

  function tekst(p: KomIGangPunkt): { titel: string; under?: string } {
    switch (p.trin) {
      case 'opret':
        return { titel: t('hjem.trin.opret') };
      case 'inviter':
        return {
          titel: t('hjem.trin.inviter'),
          under: kopieret
            ? t('invitation.kopieret')
            : kode
              ? t('hjem.trin.inviterKode', { kode })
              : t('hjem.trin.inviterUdenKode'),
        };
      case 'kategorier':
        return { titel: t('hjem.trin.kategorier'), under: t('hjem.trin.kategorierTekst', { beloeb: formatKr(50) }) };
      case 'boede':
        return { titel: t('hjem.trin.boede'), under: t('hjem.trin.boedeTekst') };
    }
  }

  function handling(p: KomIGangPunkt) {
    if (p.status === 'gjort') return null;
    const primaer = p.status === 'naeste' ? ' kom-i-gang__knap--primaer' : '';
    if (p.trin === 'inviter' && kode) {
      return (
        <button
          type="button"
          className={`kom-i-gang__knap${primaer}`}
          onClick={() => void delInvitation(bodekasseNavn, kode).then((r) => setKopieret(r === 'kopieret'))}
        >
          {t('hjem.del')}
        </button>
      );
    }
    if (p.trin === 'kategorier') {
      return (
        <button type="button" className={`kom-i-gang__knap${primaer}`} onClick={() => void navigate('/kategorier')}>
          {t('hjem.opretKategori')}
        </button>
      );
    }
    return null;
  }

  return (
    <>
      <h2 className="hjem__sektion">{t('hjem.komIGang')}</h2>
      <ol className="kom-i-gang">
        {punkter.map((p, i) => {
          const { titel, under } = tekst(p);
          return (
            <li key={p.trin} className={`kom-i-gang__punkt kom-i-gang__punkt--${p.status}`}>
              <span className="kom-i-gang__nr" aria-hidden="true">
                {p.status === 'gjort' ? <Check size={16} strokeWidth={3} /> : i + 1}
              </span>
              <span className="kom-i-gang__tekst">
                <span className="kom-i-gang__titel">{titel}</span>
                {under && <span className="kom-i-gang__under">{under}</span>}
              </span>
              {handling(p)}
            </li>
          );
        })}
      </ol>
    </>
  );
}
