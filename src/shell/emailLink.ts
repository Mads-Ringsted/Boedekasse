/**
 * What a Supabase email link left in the URL when it opened a Safari tab.
 * - `bekraeftet`: the link worked (tokens or a code in the URL).
 * - `fejl`: the link was used or expired (`error_code` in the URL).
 * - `null`: a plain visit; show the install guide.
 */
export type EmailLink = 'bekraeftet' | 'fejl' | null;

/** Reads `location.search` and `location.hash` after a Supabase redirect. */
export function readEmailLink(search: string, hash: string): EmailLink {
  const params = new URLSearchParams(search);
  for (const [key, value] of new URLSearchParams(hash.replace(/^#/, ''))) params.append(key, value);
  if (params.has('error') || params.has('error_code')) return 'fejl';
  if (params.has('access_token') || params.has('code') || params.has('token_hash')) return 'bekraeftet';
  return null;
}
