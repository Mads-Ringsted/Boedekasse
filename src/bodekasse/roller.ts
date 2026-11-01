/**
 * May handle the money: confirm or reject Betalingsmeldinger, register and
 * annul Indbetalinger, make and annul Hævninger. Admins and Kasserere may
 * (the server checks the same, `private.mine_penge`).
 */
export function kanHaandterePenge(m: { erAdmin: boolean; erKasserer: boolean }): boolean {
  return m.erAdmin || m.erKasserer;
}
