import { useState } from 'react';
import { Plus, RefreshCw, Share } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useBodekasse } from '../bodekasse/BodekasseProvider.tsx';
import { delInvitation } from '../bodekasse/delInvitation.ts';
import { Avatar } from '../components/Avatar.tsx';
import { BackButton } from '../components/BackButton.tsx';
import { Screen } from '../components/Screen.tsx';
import { hentFrikoeb } from '../frikob/hentFrikoeb.ts';
import { hentMedlemmer } from '../medlemmer/hentMedlemmer.ts';
import type { Medlemslinje } from '../medlemmer/medlemsliste.ts';
import { NyKodeSheet } from '../medlemmer/NyKodeSheet.tsx';
import { useAabnProfil } from '../profil/aabnProfil.ts';
import { TilfoejMedlemSheet } from '../medlemmer/TilfoejMedlemSheet.tsx';
import { TidligereMedlemmer } from '../medlemmer/TidligereMedlemmer.tsx';
import { formatKr, t } from '../strings/index.ts';
import { rpcErrorText } from '../supabase/rpcErrors.ts';
import { useHent } from '../supabase/useHent.ts';
import './Medlemmer.css';

/**
 * Medlemmer: every active Medlem with what they owe. Admins also get the join
 * code (Del, Ny kode) and Tilføj Medlem. Udmeldte sit under Tidligere medlemmer.
 */
export function Medlemmer() {
  const { bodekasseId, bodekasseNavn, medlemId, erAdmin } = useBodekasse();
  const navigate = useNavigate();
  const aabnProfil = useAabnProfil('mere.medlemmer');
  const data = useHent(() => hentMedlemmer(bodekasseId, medlemId, erAdmin), [bodekasseId, medlemId, erAdmin]);
  const frikoeb = useHent(() => hentFrikoeb(bodekasseId), [bodekasseId]);
  const [tilfoejer, setTilfoejer] = useState(false);
  const [fornyer, setFornyer] = useState(false);
  const [kopieret, setKopieret] = useState(false);

  const klar = data.status === 'ready' ? data.data : null;
  const kode = klar?.kode ?? null;

  return (
    <Screen>
      <BackButton label={t('tab.mere')} onClick={() => void navigate('/mere')} />
      <div className="medlemmer__top">
        <h1 className="screen__title medlemmer__titel">{t('mere.medlemmer')}</h1>
        {erAdmin && (
          <button
            type="button"
            className="medlemmer__tilfoej"
            aria-label={t('medlemmer.tilfoej')}
            onClick={() => setTilfoejer(true)}
          >
            <Plus size={22} strokeWidth={2.4} aria-hidden="true" />
          </button>
        )}
      </div>

      {kode && (
        <div className="join-kode">
          <span className="join-kode__tekst">
            <span className="join-kode__label">{kopieret ? t('invitation.kopieret') : t('medlemmer.kodeLabel')}</span>
            <span className="join-kode__kode">{kode}</span>
          </span>
          <button
            type="button"
            className="join-kode__del"
            onClick={() => void delInvitation(bodekasseNavn, kode).then((r) => setKopieret(r === 'kopieret'))}
          >
            <Share size={16} strokeWidth={2} aria-hidden="true" />
            {t('medlemmer.del')}
          </button>
          <button
            type="button"
            className="join-kode__ny"
            aria-label={t('medlemmer.nyKode')}
            onClick={() => setFornyer(true)}
          >
            <RefreshCw size={16} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
      )}

      {data.status === 'error' && (
        <button type="button" className="medlemmer__fejl" onClick={data.reload}>
          {rpcErrorText(data.error)} · {t('handling.proevIgen')}
        </button>
      )}

      {klar && (
        <>
          <h2 className="medlemmer__antal">
            {klar.linjer.length === 1 ? t('vaelg.etMedlem') : t('vaelg.antalMedlemmer', { antal: klar.linjer.length })}
          </h2>
          <ul className="medlemmer__liste">
            {klar.linjer.map((m) => (
              <li key={m.id} className="medlemmer__punkt">
                <MedlemLinje
                  m={m}
                  frikob={frikoeb.status === 'ready' ? frikoeb.data.filter((f) => f.medlemId === m.id) : []}
                  onClick={() => aabnProfil(m.id)}
                />
              </li>
            ))}
          </ul>
          <TidligereMedlemmer linjer={klar.tidligere} onAabn={aabnProfil} onGenoptaget={data.reload} />
        </>
      )}

      {erAdmin && (
        <TilfoejMedlemSheet
          open={tilfoejer}
          onOpenChange={setTilfoejer}
          kode={kode}
          onTilfoejet={data.reload}
        />
      )}
      {erAdmin && kode && (
        <NyKodeSheet
          open={fornyer}
          onOpenChange={setFornyer}
          kode={kode}
          onFornyet={() => {
            setKopieret(false);
            data.reload();
          }}
        />
      )}
    </Screen>
  );
}

/** One Medlem: avatar, name (or "Dig"), tags and what they owe. Opens their profile. */
function MedlemLinje({
  m,
  frikob = [],
  onClick,
}: {
  m: Medlemslinje;
  /** Their Frikøb now: tagged "Frikøb · For sent" (#65). */
  frikob?: readonly { bodekategoriNavn: string }[];
  onClick: () => void;
}) {
  const beloeb =
    m.saldo < 0 ? (
      <span className="medlem-linje__beloeb medlem-linje__beloeb--til-gode">
        {t('medlemmer.tilGode', { beloeb: formatKr(-m.saldo) })}
      </span>
    ) : (
      <span className={`medlem-linje__beloeb${m.saldo > 0 ? ' medlem-linje__beloeb--mangler' : ''}`}>
        {formatKr(m.saldo)}
      </span>
    );

  return (
    <button type="button" className={`medlem-linje${m.egen ? ' medlem-linje--egen' : ''}`} onClick={onClick}>
      <Avatar navn={m.navn} size={36} egen={m.egen} stiplet={!m.loggetInd} />
      <span className="medlem-linje__tekst">
        <span className="medlem-linje__navn">
          <span className="medlem-linje__navn-tekst">{m.egen ? t('medlemmer.dig') : m.navn}</span>
          {m.erAdmin && <span className="medlem-linje__tag">{t('mere.admin')}</span>}
          {frikob.length > 0 && (
            <span className="medlem-linje__tag">
              {t('frikob.medlemTag', { navne: frikob.map((f) => f.bodekategoriNavn).join(', ') })}
            </span>
          )}
        </span>
        {!m.loggetInd && <span className="medlem-linje__under">{t('medlemmer.ikkeLoggetInd')}</span>}
      </span>
      {beloeb}
    </button>
  );
}
