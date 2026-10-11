export type Destination =
  | { kind: 'velkommen' }
  | { kind: 'bodekasse'; bodekasseId: string }
  | { kind: 'vaelg' };

/**
 * Where the app opens after login: Velkommen when in no box, the
 * last-used box on this device, the only box, or else Vælg Bødekasse.
 */
export function destinationAfterLogin(bodekasseIds: readonly string[], lastUsed: string | null): Destination {
  if (bodekasseIds.length === 0) return { kind: 'velkommen' };
  if (lastUsed && bodekasseIds.includes(lastUsed)) return { kind: 'bodekasse', bodekasseId: lastUsed };
  if (bodekasseIds.length === 1) return { kind: 'bodekasse', bodekasseId: bodekasseIds[0] };
  return { kind: 'vaelg' };
}
