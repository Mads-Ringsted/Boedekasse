import { useState } from 'react';
import { ArrowUpRight, Plus } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router';
import { useBodekasse } from '../bodekasse/BodekasseProvider.tsx';
import { AfventerKort } from '../betal/AfventerKort.tsx';
import { BackButton } from '../components/BackButton.tsx';
import { Screen } from '../components/Screen.tsx';
import { formatKr, t } from '../strings/index.ts';
import { rpcErrorText } from '../supabase/rpcErrors.ts';
import { useHent } from '../supabase/useHent.ts';
import { AnnullerHaevningSheet } from './AnnullerHaevningSheet.tsx';
import { AnnullerIndbetalingSheet } from './AnnullerIndbetalingSheet.tsx';
import { HaevPengeSheet } from './HaevPengeSheet.tsx';
import { hentKassen } from './hentKassen.ts';
import { dagTekst, type KassePost } from './kassen.ts';
import { RegistrerIndbetalingSheet } from './RegistrerIndbetalingSheet.tsx';
import './Kassen.css';

/** Navigate here with this state to get "‹ Mere" as the back button (default "‹ Hjem"). */
export const FRA_MERE = { fra: 'mere' } as const;

/**
 * Kassen: I bødekassen, then Indbetalt / Hævet / Mangler, the Admin buttons,
 * and every Indbetaling and Hævning. An Admin taps one from the latest Sæson
 * to annul it.
 */
export function Kassen() {
  const { bodekasseId, erAdmin } = useBodekasse();
  const navigate = useNavigate();
  const fraMere = (useLocation().state as { fra?: string } | null)?.fra === 'mere';
  const kassen = useHent(() => hentKassen(bodekasseId, erAdmin), [bodekasseId, erAdmin]);
  const data = kassen.status === 'ready' ? kassen.data : null;
  const [registrerer, setRegistrerer] = useState(0);
  const [haever, setHaever] = useState(0);
  const [annullerer, setAnnullerer] = useState<KassePost | null>(null);

  return (
    <Screen>
      <BackButton
        label={t(fraMere ? 'tab.mere' : 'tab.hjem')}
        onClick={() => void navigate(fraMere ? '/mere' : '/')}
      />
      <h1 className="screen__title kassen__titel">{t('kassen.titel')}</h1>

      <div className="kassen__kort">
        <span className="kassen__kort-label">{t('hjem.iBoedekassen')}</span>
        <span className="kassen__kort-beloeb">{data ? formatKr(data.beloeb) : ' '}</span>
      </div>

      <div className="kassen__tal">
        <Tal label={t('hjem.indbetalt')} beloeb={data?.indbetalt} tone="ind" />
        <Tal label={t('kassen.haevet')} beloeb={data?.haevet} />
        <Tal label={t('kassen.mangler')} beloeb={data?.mangler} tone="mangler" />
      </div>

      {erAdmin && (
        // One column per button.
        <div className="kassen__knapper">
          <button type="button" className="kassen__knap kassen__knap--primaer" onClick={() => setRegistrerer((n) => n + 1)}>
            <Plus size={18} strokeWidth={2.4} aria-hidden="true" />
            {t('kassen.registrer')}
          </button>
          <button type="button" className="kassen__knap" disabled={!data} onClick={() => setHaever((n) => n + 1)}>
            <ArrowUpRight size={18} strokeWidth={2} aria-hidden="true" />
            {t('kassen.haevPenge')}
          </button>
        </div>
      )}

      <AfventerKort variant="kassen" onBehandlet={kassen.reload} />

      {kassen.status === 'error' && (
        <button type="button" className="kassen__fejl" onClick={kassen.reload}>
          {rpcErrorText(kassen.error)} · {t('handling.proevIgen')}
        </button>
      )}

      {data && (
        <>
          <h2 className="kassen__sektion">{t('kassen.liste')}</h2>
          {data.poster.length === 0 ? (
            <p className="kassen__tom">{t('kassen.tom')}</p>
          ) : (
            <ul className="kassen__liste">
              {data.poster.map((p) => (
                <Post key={p.id} post={p} onAnnuller={() => setAnnullerer(p)} />
              ))}
            </ul>
          )}
        </>
      )}

      {erAdmin && registrerer > 0 && (
        <RegistrerIndbetalingSheet
          key={`registrer-${registrerer}`}
          open
          onOpenChange={(aaben) => !aaben && setRegistrerer(0)}
          onRegistreret={kassen.reload}
        />
      )}
      {erAdmin && haever > 0 && data && (
        <HaevPengeSheet
          key={`haev-${haever}`}
          open
          onOpenChange={(aaben) => !aaben && setHaever(0)}
          kassen={data.beloeb}
          onHaevet={kassen.reload}
        />
      )}
      {annullerer?.art === 'haevning' && (
        <AnnullerHaevningSheet
          key={`annuller-${annullerer.id}`}
          post={annullerer}
          open
          onOpenChange={(aaben) => !aaben && setAnnullerer(null)}
          onAnnulleret={kassen.reload}
        />
      )}
      {annullerer?.art === 'indbetaling' && (
        <AnnullerIndbetalingSheet
          key={`annuller-${annullerer.id}`}
          post={annullerer}
          open
          onOpenChange={(aaben) => !aaben && setAnnullerer(null)}
          onAnnulleret={kassen.reload}
        />
      )}
    </Screen>
  );
}

function Tal({ label, beloeb, tone }: { label: string; beloeb: number | undefined; tone?: 'ind' | 'mangler' }) {
  return (
    <div className="kassen__tal-kort">
      <span className="kassen__tal-label">{label}</span>
      <span className={`kassen__tal-beloeb${tone ? ` kassen__tal-beloeb--${tone}` : ''}`}>
        {beloeb === undefined ? ' ' : formatKr(beloeb)}
      </span>
    </div>
  );
}

/**
 * One Indbetaling (who paid, who registered it, when) or Hævning (who took
 * it out, the purpose, when); struck through if annulled.
 */
function Post({ post, onAnnuller }: { post: KassePost; onAnnuller: () => void }) {
  const haevning = post.art === 'haevning';
  const titel = haevning ? t('kassen.haevetAf', { navn: post.registreretAf }) : post.navn;
  const under = post.annulleret
    ? [t('kassen.annulleretAf', { navn: post.annulleret.af }), dagTekst(post.annulleret.tid), post.annulleret.note]
    : haevning
      ? [post.formaal, dagTekst(post.tid)]
      : [t('kassen.registreretAf', { navn: post.registreretAf }), dagTekst(post.tid), post.note];
  const beloeb = formatKr(post.beloeb);
  const indhold = (
    <>
      <span className="kassen-post__tekst">
        <span className="kassen-post__navn">{titel}</span>
        <span className="kassen-post__under">{under.filter(Boolean).join(' · ')}</span>
      </span>
      <span className="kassen-post__beloeb">{t(haevning ? 'kassen.minus' : 'kassen.plus', { beloeb })}</span>
    </>
  );
  const klasse = `kassen-post kassen-post--${post.art}${post.annulleret ? ' kassen-post--annulleret' : ''}`;

  return (
    <li className="kassen__raekke">
      {post.kanAnnulleres ? (
        <button type="button" className={klasse} onClick={onAnnuller}>
          {indhold}
        </button>
      ) : (
        <div className={klasse}>{indhold}</div>
      )}
    </li>
  );
}
