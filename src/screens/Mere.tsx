import { useState, type ReactNode } from 'react';
import { ArrowLeftRight, ChevronRight, Coins, LogOut, Scale, Settings, Trophy, Users, type LucideIcon } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthProvider.tsx';
import { useBodekasse } from '../bodekasse/BodekasseProvider.tsx';
import { SkiftBodekasseSheet } from '../bodekasse/SkiftBodekasseSheet.tsx';
import { Avatar } from '../components/Avatar.tsx';
import { Screen } from '../components/Screen.tsx';
import { formatKr, t, type PlainStringId } from '../strings/index.ts';
import { supabase } from '../supabase/index.ts';
import { useHent } from '../supabase/useHent.ts';
import './Mere.css';

/** The numbers shown at the end of Mere's rows. */
async function hentMere(bodekasseId: string) {
  const [medlemmer, kassen] = await Promise.all([
    supabase
      .from('medlem')
      .select('id', { count: 'exact', head: true })
      .eq('bodekasse_id', bodekasseId)
      .is('udmeldt', null),
    supabase.from('kassen').select('beloeb').eq('bodekasse_id', bodekasseId).maybeSingle(),
  ]);
  if (medlemmer.error) throw medlemmer.error;
  if (kassen.error) throw kassen.error;
  return { antalMedlemmer: medlemmer.count ?? 0, iBoedekassen: kassen.data?.beloeb ?? 0 };
}

interface RowProps {
  Icon: LucideIcon;
  label: PlainStringId;
  onClick: () => void;
  /** Shown before the chevron: a count, an amount or a tag. */
  trailing?: ReactNode;
}

function Row({ Icon, label, onClick, trailing }: RowProps) {
  return (
    <button type="button" className="mere__row" onClick={onClick}>
      <span className="mere__icon">
        <Icon size={18} strokeWidth={2} aria-hidden="true" />
      </span>
      <span className="mere__label">{t(label)}</span>
      {trailing}
      <ChevronRight className="mere__chevron" size={18} strokeWidth={2.2} aria-hidden="true" />
    </button>
  );
}

/**
 * Mere: your profile row, the box's screens, Skift Bødekasse and Log ud.
 * Rows open stand-in screens until their tickets build them.
 */
export function Mere() {
  const { logOut } = useAuth();
  const { bodekasseId, navn, erAdmin } = useBodekasse();
  const navigate = useNavigate();
  const [skifter, setSkifter] = useState(false);
  const tal = useHent(() => hentMere(bodekasseId), [bodekasseId]);
  const data = tal.status === 'ready' ? tal.data : null;

  return (
    <Screen title={t('skaerm.mere')}>
      <button type="button" className="mere__profil" onClick={() => void navigate('/profil')}>
        <Avatar navn={navn} size={52} egen />
        <span className="mere__profil-tekst">
          <span className="mere__profil-navn">{navn}</span>
          <span className="mere__profil-under">{t(erAdmin ? 'mere.adminSeProfil' : 'mere.seProfil')}</span>
        </span>
        <ChevronRight className="mere__chevron" size={20} strokeWidth={2.2} aria-hidden="true" />
      </button>

      <div className="mere__gruppe">
        <Row
          Icon={Users}
          label="mere.medlemmer"
          onClick={() => void navigate('/medlemmer')}
          trailing={data && <span className="mere__vaerdi">{data.antalMedlemmer}</span>}
        />
        <Row
          Icon={Coins}
          label="mere.kassen"
          onClick={() => void navigate('/kassen')}
          trailing={data && <span className="mere__vaerdi">{formatKr(data.iBoedekassen)}</span>}
        />
        <Row Icon={Scale} label="mere.anker" onClick={() => void navigate('/anker')} />
        <Row Icon={Trophy} label="mere.konkurrencer" onClick={() => void navigate('/konkurrencer')} />
      </div>

      <div className="mere__gruppe">
        {erAdmin && (
          <Row
            Icon={Settings}
            label="mere.indstillinger"
            onClick={() => void navigate('/indstillinger')}
            trailing={<span className="mere__tag">{t('mere.admin')}</span>}
          />
        )}
        <Row Icon={ArrowLeftRight} label="mere.skift" onClick={() => setSkifter(true)} />
      </div>

      <button type="button" className="mere__logud" onClick={() => void logOut()}>
        <LogOut size={20} aria-hidden="true" />
        {t('logUd')}
      </button>

      <SkiftBodekasseSheet open={skifter} onOpenChange={setSkifter} />
    </Screen>
  );
}
