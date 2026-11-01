const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A push link is an in-app path plus `?bodekasse=<id>` (see `private.push`).
 * Returns the box to open and the query string without it, or null for an
 * ordinary address.
 */
export function laesPushLink(search: string): { bodekasseId: string; search: string } | null {
  const params = new URLSearchParams(search);
  const bodekasseId = params.get('bodekasse');
  if (!bodekasseId || !UUID.test(bodekasseId)) return null;
  params.delete('bodekasse');
  const rest = params.toString();
  return { bodekasseId, search: rest ? `?${rest}` : '' };
}
