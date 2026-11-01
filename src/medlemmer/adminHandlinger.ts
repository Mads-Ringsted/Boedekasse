/** Why a Medlem can't be deleted (the `medlem_slet_grund` view); null = they can. */
export type SletGrund = 'logget_ind' | 'boeder' | 'gebyrer' | 'indbetalinger' | 'historik';

/** What the Admin actions sheet needs to know about the Medlem. */
export interface AdminMedlem {
  erAdmin: boolean;
  erKasserer: boolean;
  loggetInd: boolean;
  udmeldt: boolean;
  email: string | null;
}

export type AdminHandling =
  | { art: 'registrerIndbetaling' }
  | { art: 'registrerFrikob' }
  | { art: 'goerTilAdmin' }
  | { art: 'fjernSomAdmin' }
  | { art: 'goerTilKasserer' }
  | { art: 'fjernSomKasserer' }
  | { art: 'retNavn' }
  | { art: 'retEmail'; email: string | null }
  | { art: 'meldUd' }
  | { art: 'genoptag' }
  | { art: 'slet'; grund: SletGrund | null };

export interface AdminHandlinger {
  /** The first group: Registrér indbetaling, Registrér frikøb, roles, Ret navn, Ret email. */
  hoved: AdminHandling[];
  /** The red group: Meld ud (or Genoptag) and Slet. */
  farlig: AdminHandling[];
}

/**
 * The rows in "Handlinger for X", in mock order (medlem-admin.html).
 * Your own profile has only Registrér indbetaling and your roles (your name has
 * its own pencil, and nobody melder themself ud). An Udmeldt has no role to
 * change and gets Genoptag instead of Meld ud. Roles: Admin, then Kasserer (#75). Ret email only before they log in.
 * Registrér frikøb (`frikob`: Frikøb is on and a Sæson runs) is for an active
 * Medlem's profile; on your own, Køb Frikøb is a profile button.
 */
export function adminHandlinger(
  m: AdminMedlem,
  { egen, sletGrund, frikob = false }: { egen: boolean; sletGrund: SletGrund | null; frikob?: boolean },
): AdminHandlinger {
  const hoved: AdminHandling[] = [{ art: 'registrerIndbetaling' }];
  if (frikob && !egen && !m.udmeldt) hoved.push({ art: 'registrerFrikob' });
  if (!m.udmeldt) {
    hoved.push({ art: m.erAdmin ? 'fjernSomAdmin' : 'goerTilAdmin' });
    hoved.push({ art: m.erKasserer ? 'fjernSomKasserer' : 'goerTilKasserer' });
  }
  if (!egen) hoved.push({ art: 'retNavn' });
  if (!egen && !m.loggetInd) hoved.push({ art: 'retEmail', email: m.email });

  const farlig: AdminHandling[] = egen
    ? []
    : [{ art: m.udmeldt ? 'genoptag' : 'meldUd' }, { art: 'slet', grund: sletGrund }];
  return { hoved, farlig };
}
