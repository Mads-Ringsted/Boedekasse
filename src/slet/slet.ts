/**
 * Slet Bødekasse is enabled only when you typed the box's exact name. Spaces
 * around it don't count; case does. Same rule as `slet_bodekasse`.
 */
export function navnPasser(skrevet: string, navn: string): boolean {
  return skrevet.trim() === navn;
}
