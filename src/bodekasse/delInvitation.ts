import { t } from '../strings/index.ts';

/**
 * Opens the iOS share sheet with an invite text holding the join code.
 * Falls back to copying the text where sharing isn't available.
 */
export async function delInvitation(bodekasseNavn: string, kode: string): Promise<'delt' | 'kopieret' | 'afbrudt'> {
  const text = t('invitation.tekst', { navn: bodekasseNavn, kode, url: window.location.origin });
  if (navigator.share) {
    try {
      await navigator.share({ text });
      return 'delt';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'afbrudt';
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return 'kopieret';
  } catch {
    return 'afbrudt';
  }
}
