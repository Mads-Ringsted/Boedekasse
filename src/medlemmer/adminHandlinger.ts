/** Why a Medlem can't be deleted (the `medlem_slet_grund` view); null = they can. */
export type SletGrund = 'logget_ind' | 'boeder' | 'gebyrer' | 'indbetalinger' | 'historik';

/** What the Admin actions sheet needs to know about the Medlem. */
export interface AdminMedlem {
  erAdmin: boolean;
  loggetInd: boolean;
  udmeldt: boolean;
  email: string | null;
}

export type AdminHandling =
  | { art: 'registrerIndbetaling' }
  | { art: 'goerTilAdmin' }
  | { art: 'fjernSomAdmin' }
  | { art: 'retNavn' }
  | { art: 'retEmail'; email: string | null }
  | { art: 'meldUd' }
  | { art: 'genoptag' }
  | { art: 'slet'; grund: SletGrund | null };

export interface AdminHandlinger {
  /** The first group: Registrér indbetaling, role, Ret navn, Ret email. */
  hoved: AdminHandling[];
  /** The red group: Meld ud (or Genoptag) and Slet. */
  farlig: AdminHandling[];
}

/**
 * The rows in "Handlinger for X", in mock order (medlem-admin.html).
 * Your own profile has only Registrér indbetaling and your role (your name has
 * its own pencil, and nobody melder themself ud). An Udmeldt has no role to
 * change and gets Genoptag instead of Meld ud. Ret email only before they log in.
 */
export function adminHandlinger(
  m: AdminMedlem,
  { egen, sletGrund }: { egen: boolean; sletGrund: SletGrund | null },
): AdminHandlinger {
  const hoved: AdminHandling[] = [{ art: 'registrerIndbetaling' }];
  if (!m.udmeldt) hoved.push({ art: m.erAdmin ? 'fjernSomAdmin' : 'goerTilAdmin' });
  if (!egen) hoved.push({ art: 'retNavn' });
  if (!egen && !m.loggetInd) hoved.push({ art: 'retEmail', email: m.email });

  const farlig: AdminHandling[] = egen
    ? []
    : [{ art: m.udmeldt ? 'genoptag' : 'meldUd' }, { art: 'slet', grund: sletGrund }];
  return { hoved, farlig };
}
