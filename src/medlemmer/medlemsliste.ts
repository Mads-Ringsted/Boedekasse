/** The `medlem` columns the list needs. */
export interface MedlemRaekke {
  id: string;
  navn: string;
  er_admin: boolean;
  user_id: string | null;
  udmeldt: string | null;
}

/** One row of the `medlem_saldo` view. */
export interface SaldoRaekke {
  medlem_id: string;
  saldo: number;
}

/** One row on Medlemmer. */
export interface Medlemslinje {
  id: string;
  navn: string;
  erAdmin: boolean;
  /** False for a pre-added Medlem who has not logged in yet (dashed avatar). */
  loggetInd: boolean;
  /** Your own row (highlighted). */
  egen: boolean;
  /** What they owe in kr; negative = Til gode. */
  saldo: number;
}

const danskOrden = new Intl.Collator('da');

/** Active Medlemmer by name (Danish order), each with what they owe. */
export function medlemsliste(medlemmer: MedlemRaekke[], saldi: SaldoRaekke[], mitId: string): Medlemslinje[] {
  const saldoFor = new Map(saldi.map((s) => [s.medlem_id, s.saldo]));
  return medlemmer
    .filter((m) => m.udmeldt === null)
    .map((m) => ({
      id: m.id,
      navn: m.navn,
      erAdmin: m.er_admin,
      loggetInd: m.user_id !== null,
      egen: m.id === mitId,
      saldo: saldoFor.get(m.id) ?? 0,
    }))
    .sort((a, b) => danskOrden.compare(a.navn, b.navn));
}

/** One row under Tidligere medlemmer. */
export interface TidligereLinje {
  id: string;
  navn: string;
  /** What they still owe in kr; negative = Til gode. */
  saldo: number;
}

/** Udmeldte Medlemmer by name (Danish order), each with what they still owe. */
export function tidligereMedlemmer(medlemmer: MedlemRaekke[], saldi: SaldoRaekke[]): TidligereLinje[] {
  const saldoFor = new Map(saldi.map((s) => [s.medlem_id, s.saldo]));
  return medlemmer
    .filter((m) => m.udmeldt !== null)
    .map((m) => ({ id: m.id, navn: m.navn, saldo: saldoFor.get(m.id) ?? 0 }))
    .sort((a, b) => danskOrden.compare(a.navn, b.navn));
}
