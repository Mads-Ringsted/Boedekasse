const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Reads one id parameter from a query string, and the query string without it. */
function laesId(search: string, navn: string): { id: string; search: string } | null {
  const params = new URLSearchParams(search);
  const id = params.get(navn);
  if (!id || !UUID.test(id)) return null;
  params.delete(navn);
  const rest = params.toString();
  return { id, search: rest ? `?${rest}` : '' };
}

/**
 * A push link is an in-app path plus `?bodekasse=<id>` (see `private.push`).
 * Returns the box to open and the query string without it, or null for an
 * ordinary address.
 */
export function laesPushLink(search: string): { bodekasseId: string; search: string } | null {
  const link = laesId(search, 'bodekasse');
  return link && { bodekasseId: link.id, search: link.search };
}

/**
 * An Anke push links to its Bøde: `/anker?bode=<id>`. Returns the Bøde to
 * open in the detail sheet and the query string without it, or null.
 */
export function laesBoedeLink(search: string): { boedeId: string; search: string } | null {
  const link = laesId(search, 'bode');
  return link && { boedeId: link.id, search: link.search };
}
