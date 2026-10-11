import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { useParams } from 'react-router';
import { Feed } from '../aktivitet/Feed.tsx';
import { useBoedeDetalje } from '../aktivitet/boede/BoedeDetaljeProvider.tsx';
import { TagMaerke } from '../aktivitet/TagMaerke.tsx';
import type { Tag } from '../aktivitet/visning.ts';
import { useBodekasse } from '../bodekasse/BodekasseProvider.tsx';
import { Avatar } from '../components/Avatar.tsx';
import { BackButton } from '../components/BackButton.tsx';
import { Screen } from '../components/Screen.tsx';
import { useGivBoeder } from '../giv/GivBoederProvider.tsx';
import { RetMitNavnSheet } from '../medlemmer/RetMitNavnSheet.tsx';
import { SletKontoSheet } from '../slet/SletKontoSheet.tsx';
import { formatKr, t } from '../strings/index.ts';
import { useHent } from '../supabase/useHent.ts';
import { useProfilTilbage } from './aabnProfil.ts';
import { PROFIL_KNAPPER, PROFIL_KORT, PROFIL_TOP, type ProfilDelProps } from './handlinger.ts';
import { hentProfil } from './hentProfil.ts';
import { profilVisning, type Profil, type ProfilTag, type ProfilVisning } from './profil.ts';
import './Profil.css';

/** Red while something is owed, green for Til gode, plain at 0. */
const saldoKlasse = (v: ProfilVisning) =>
  v.status.art === 'tilGode' ? 'profil__beloeb--til-gode' : v.status.beloeb > 0 ? 'profil__beloeb--mangler' : '';

const TAGS: Record<ProfilTag, Tag> = {
  admin: { tekst: t('profil.tag.admin'), tone: 'blaa' },
  ikkeLoggetInd: { tekst: t('profil.tag.ikkeLoggetInd'), tone: 'graa' },
  udmeldt: { tekst: t('profil.tag.udmeldt'), tone: 'graa' },
};

/**
 * The profile route: `/medlem/:medlemId`, or your own at `/profil`. Keyed by
 * Medlem, so moving between profiles starts fresh.
 */
export function ProfilRute() {
  const { medlemId: migId } = useBodekasse();
  const { medlemId = migId } = useParams();
  return <ProfilSkaerm key={medlemId} medlemId={medlemId} />;
}

/**
 * A Medlem's profile: avatar, name, tags, what they owe (or Til gode), the
 * latest Sæson's figures, actions (PROFIL_KNAPPER), cards (PROFIL_KORT) and
 * their history. Your own profile also has Ret navn and Slet konto.
 */
function ProfilSkaerm({ medlemId }: { medlemId: string }) {
  const { bodekasseId, medlemId: migId, erAdmin, navn: mitNavn } = useBodekasse();
  const { label, tilbage } = useProfilTilbage();
  const { version: givVersion } = useGivBoeder();
  const { version: boedeVersion } = useBoedeDetalje();
  const hentet = useHent(() => hentProfil(bodekasseId, medlemId), [bodekasseId, medlemId, givVersion, boedeVersion]);
  // The history reloads with the figures when a part says something changed.
  const [runde, setRunde] = useState(0);

  const profil = hentet.status === 'ready' ? hentet.data : null;
  const visning = profil && profilVisning(profil, migId);
  const del: ProfilDelProps | null =
    profil && visning
      ? {
          profil,
          visning,
          mig: { medlemId: migId, erAdmin },
          opdater: () => {
            hentet.reload();
            setRunde((n) => n + 1);
          },
        }
      : null;

  return (
    <Screen>
      <div className="profil__top">
        <BackButton label={t(label)} onClick={tilbage} />
        {del && (
          <span className="profil__top-handlinger">
            {PROFIL_TOP.map((Del, i) => (
              <Del key={i} {...del} />
            ))}
          </span>
        )}
      </div>

      {hentet.status === 'error' && (
        <button type="button" className="profil__fejl" onClick={hentet.reload}>
          {t('fejl.ukendt')}
        </button>
      )}
      {hentet.status === 'ready' && !profil && <p className="screen__placeholder">{t('profil.findesIkke')}</p>}

      {del &&
        (del.visning.egen ? (
          <EgenToppen profil={del.profil} visning={del.visning} navn={mitNavn} />
        ) : (
          <AndensToppen profil={del.profil} visning={del.visning} />
        ))}

      {visning?.overfoert && (
        <div className="profil__overfoert">
          <span className="profil__label">{t('profil.overfoert')}</span>
          <span className="profil__overfoert-beloeb">{visning.overfoert}</span>
        </div>
      )}

      {del && (
        <div className="profil__knapper">
          {PROFIL_KNAPPER.map((Del, i) => (
            <Del key={i} {...del} />
          ))}
        </div>
      )}

      {del && PROFIL_KORT.map((Del, i) => <Del key={i} {...del} />)}

      {profil && (
        <>
          <h2 className="profil__sektion">{t('profil.historik')}</h2>
          <Feed key={runde} medlemId={profil.id} />
        </>
      )}

      {visning?.egen && <SletKontoKnap />}
    </Screen>
  );
}

/** "Slet konto" at the bottom of your own profile. Each opening mounts a fresh sheet. */
function SletKontoKnap() {
  const [aabning, setAabning] = useState(0);
  return (
    <>
      <button type="button" className="profil__slet-konto" onClick={() => setAabning((n) => n + 1)}>
        {t('profil.sletKonto')}
      </button>
      {aabning > 0 && <SletKontoSheet key={aabning} open onOpenChange={(aaben) => !aaben && setAabning(0)} />}
    </>
  );
}

function Tags({ tags }: { tags: ProfilTag[] }) {
  if (tags.length === 0) return null;
  return (
    <span className="profil__tags">
      {tags.map((tag) => (
        <TagMaerke key={tag} tag={TAGS[tag]} />
      ))}
    </span>
  );
}

/** Someone else's profile: centred avatar and name, then "Mangler at betale" large. */
function AndensToppen({ profil, visning }: { profil: Profil; visning: ProfilVisning }) {
  const tilGode = visning.status.art === 'tilGode';
  return (
    <>
      <div className="profil__hoved">
        <Avatar navn={profil.navn} size={80} stiplet={!profil.loggetInd} tidligere={profil.udmeldt} />
        <h1 className="profil__navn">{profil.navn}</h1>
        <Tags tags={visning.tags} />
      </div>
      <div className="profil__saldo">
        <span className="profil__label">{t(tilGode ? 'profil.tilGode' : 'profil.manglerAtBetale')}</span>
        <span className={`profil__saldo-beloeb ${saldoKlasse(visning)}`}>
          {formatKr(visning.status.beloeb)}
        </span>
      </div>
      <div className="profil__tal">
        <Tal label={t('profil.boederOgGebyrer')} beloeb={profil.boederOgGebyrer} />
        <Tal label={t('profil.betalt')} beloeb={profil.betalt} className="profil__beloeb--betalt" />
      </div>
    </>
  );
}

/** Your own profile: avatar beside your name (with Ret navn), then three figures in a row. */
function EgenToppen({ profil, visning, navn }: { profil: Profil; visning: ProfilVisning; navn: string }) {
  const [retterNavn, setRetterNavn] = useState(false);
  const tilGode = visning.status.art === 'tilGode';
  return (
    <>
      <div className="profil__hoved profil__hoved--egen">
        <Avatar navn={navn} size={64} egen />
        <span className="profil__hoved-tekst">
          <span className="profil__navn-linje">
            <h1 className="profil__navn">{navn}</h1>
            <button
              type="button"
              className="profil__ret-navn"
              aria-label={t('mitNavn.ret')}
              onClick={() => setRetterNavn(true)}
            >
              <Pencil size={16} strokeWidth={2} aria-hidden="true" />
            </button>
          </span>
          <Tags tags={visning.tags} />
        </span>
      </div>
      <div className="profil__tal profil__tal--tre">
        <Tal
          label={t(tilGode ? 'profil.tilGode' : 'profil.mangler')}
          beloeb={visning.status.beloeb}
          className={saldoKlasse(visning)}
        />
        <Tal label={t('profil.boederOgGebyrer')} beloeb={profil.boederOgGebyrer} />
        <Tal label={t('profil.betalt')} beloeb={profil.betalt} className="profil__beloeb--betalt" />
      </div>
      <RetMitNavnSheet open={retterNavn} onOpenChange={setRetterNavn} />
    </>
  );
}

function Tal({ label, beloeb, className = '' }: { label: string; beloeb: number; className?: string }) {
  return (
    <div className="profil__tal-kort">
      <span className="profil__label">{label}</span>
      <span className={`profil__tal-beloeb ${className}`}>{formatKr(beloeb)}</span>
    </div>
  );
}
