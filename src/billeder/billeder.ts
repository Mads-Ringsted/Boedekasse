import { supabase } from '../supabase/index.ts';
import { BUCKET, billedSti, skalSigneres, UDLOEB_SEK, type BilledType, type SigneretUrl } from './billede.ts';

/**
 * Profilbilleder against Supabase: the session's signed-URL cache, the
 * upload, and the two RPCs. Screens read pictures through `useBilleder()`
 * (BilledProvider.tsx), not from here.
 */

// ---------- Signed URLs, cached for the session ----------

// Keyed by object path. Paths never change content (each upload gets a new
// name), so a URL stays right until it expires.
const cache = new Map<string, SigneretUrl>();

/** Signs, in one request, every path that has no fresh signed URL yet. */
export async function signerBilleder(stier: Iterable<string>): Promise<void> {
  const mangler = skalSigneres(stier, cache, Date.now());
  if (mangler.length === 0) return;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(mangler, UDLOEB_SEK);
  if (error) throw error;
  const udloeber = Date.now() + UDLOEB_SEK * 1000;
  for (const r of data) {
    if (r.path && r.signedUrl && !r.error) cache.set(r.path, { url: r.signedUrl, udloeber });
  }
}

/** The cached signed URL for a path, if any. Call `signerBilleder` first. */
export function signeret(sti: string): SigneretUrl | undefined {
  return cache.get(sti);
}

/** Drops a path's URL, so the next `signerBilleder` signs it again. */
export function glemSigneret(sti: string): void {
  cache.delete(sti);
}

// ---------- Changing your own picture (used by the picker, #101) ----------

/**
 * Uploads a finished (cropped, shrunk) picture into your own Medlem's folder
 * and returns its path. Then call `saetMitBillede` with that path.
 */
export async function uploadBillede(
  bodekasseId: string,
  medlemId: string,
  fil: Blob,
  type: BilledType,
): Promise<{ sti: string; error: Error | null }> {
  const sti = billedSti(bodekasseId, medlemId, type);
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(sti, fil, { contentType: type, cacheControl: '31536000', upsert: false });
  return { sti, error };
}

/**
 * Deletes an upload that was never set (e.g. `saetMitBillede` failed), so it
 * doesn't wait in your folder. Best effort: errors are ignored.
 */
export async function sletUpload(sti: string): Promise<void> {
  await supabase.storage.from(BUCKET).remove([sti]).catch(() => {});
}

/**
 * Points your Medlem in this box at an uploaded picture. Errors (map with
 * `rpcErrorText`): ikke_medlem, billede_sti_ugyldig, billede_findes_ikke.
 * Afterwards call `opdater()` from `useBilleder()`.
 */
export function saetMitBillede(klientId: string, bodekasseId: string, sti: string) {
  return supabase.rpc('saet_mit_billede', { p_klient_id: klientId, p_bodekasse: bodekasseId, p_sti: sti });
}

/** Removes your picture in this box. Afterwards call `opdater()` from `useBilleder()`. */
export function fjernMitBillede(klientId: string, bodekasseId: string) {
  return supabase.rpc('fjern_mit_billede', { p_klient_id: klientId, p_bodekasse: bodekasseId });
}
