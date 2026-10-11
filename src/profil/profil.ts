import { minStatus, type MinStatus } from '../screens/hjem/topliste.ts';

/** One Medlem's profile data (see `hentProfil`). */
export interface Profil {
  id: string;
  navn: string;
  erAdmin: boolean;
  /** False for a pre-added Medlem who has not logged in yet. */
  loggetInd: boolean;
  udmeldt: boolean;
  /** Saldo across all Sæsoner, in kr; negative = Til gode. */
  saldo: number;
  /** Bøder i alt in the latest Sæson (borne Bøder + every Gebyr kind), in kr. */
  boederOgGebyrer: number;
  /** Indbetalt in the latest Sæson, in kr. */
  betalt: number;
}

/** The small tags under a profile's name, in display order. */
export type ProfilTag = 'admin' | 'ikkeLoggetInd' | 'udmeldt';

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
}

/** What a profile shows, given whose it is and who is looking. */
export function profilVisning(p: Profil, migId: string): ProfilVisning {
  const egen = p.id === migId;
  const status = minStatus(p.saldo);
  const tags: ProfilTag[] = [];
  if (p.erAdmin) tags.push('admin');
  if (!p.loggetInd) tags.push('ikkeLoggetInd');
  if (p.udmeldt) tags.push('udmeldt');
  return {
    egen,
    tags,
    status,
    kanGiveBoede: !egen && !p.udmeldt,
    kanBetale: egen && status.kanBetale,
  };
}
