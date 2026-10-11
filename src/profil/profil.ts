import { minStatus, type MinStatus } from '../screens/hjem/topliste.ts';
import { formatKr, t } from '../strings/index.ts';

/** One Medlem's profile data (see `hentProfil`). */
export interface Profil {
  id: string;
  navn: string;
  erAdmin: boolean;
  /** False for a pre-added Medlem who has not logged in yet. */
  loggetInd: boolean;
  /** Their login was deleted (Slet konto): an unclaimed spot that once was claimed. */
  kontoSlettet: boolean;
  udmeldt: boolean;
  /** Saldo across all Sæsoner, in kr; negative = Til gode. */
  saldo: number;
  /** Bøder i alt in the latest Sæson (borne Bøder + every Gebyr kind), in kr. */
  boederOgGebyrer: number;
  /** Indbetalt in the latest Sæson, in kr. */
  betalt: number;
  /** Saldo at the latest Sæson's start ("Overført fra sidste sæson"), in kr; negative = Til gode. */
  overfoert: number;
}

/** The small tags under a profile's name, in display order. */
export type ProfilTag = 'admin' | 'ikkeLoggetInd' | 'kontoSlettet' | 'udmeldt';

export interface ProfilVisning {
  /** Your own profile. */
  egen: boolean;
  tags: ProfilTag[];
  /** "Mangler at betale" or "Til gode". */
  status: MinStatus;
  /** "Giv bøde": not on your own profile, not for an Udmeldt. */
  kanGiveBoede: boolean;
  /** "Betal": your own profile, while you owe something. */
  kanBetale: boolean;
  /** The "Overført fra sidste sæson" amount, e.g. "150 kr" or "30 kr til gode"; null at 0. */
  overfoert: string | null;
}

/** What a profile shows, given whose it is and who is looking. */
export function profilVisning(p: Profil, migId: string): ProfilVisning {
  const egen = p.id === migId;
  const status = minStatus(p.saldo);
  const tags: ProfilTag[] = [];
  if (p.erAdmin) tags.push('admin');
  if (p.kontoSlettet) tags.push('kontoSlettet');
  else if (!p.loggetInd) tags.push('ikkeLoggetInd');
  if (p.udmeldt) tags.push('udmeldt');
  return {
    egen,
    tags,
    status,
    kanGiveBoede: !egen && !p.udmeldt,
    kanBetale: egen && status.kanBetale,
    overfoert:
      p.overfoert === 0
        ? null
        : p.overfoert > 0
          ? formatKr(p.overfoert)
          : t('profil.overfoertTilGode', { beloeb: formatKr(-p.overfoert) }),
  };
}
