import { useEffect, useState } from 'react';
import { useBodekasse, useMedlemskaber } from '../bodekasse/BodekasseProvider.tsx';
import { useHent } from '../supabase/useHent.ts';
import { hentIndstillinger, opdaterIndstillinger } from './hentIndstillinger.ts';
import type { IndstillingAendringer, Indstillinger } from './indstillinger.ts';

/**
 * The open box's settings, plus `gem(aendringer)` for Admins. A change shows
 * at once (a switch flips before the answer comes); if the server says no,
 * it flips back and `gem` throws the RPC error.
 */
export function useIndstillinger() {
  const { bodekasseId } = useBodekasse();
  const { reload: reloadMedlemskaber } = useMedlemskaber();
  const hentet = useHent(() => hentIndstillinger(bodekasseId), [bodekasseId]);
  const [vist, setVist] = useState<IndstillingAendringer>({});

  // Fresh data from the server already holds every change that went through.
  const data = hentet.status === 'ready' ? hentet.data : null;
  useEffect(() => setVist({}), [data]);

  const indstillinger: Indstillinger | null = data && { ...data.indstillinger, ...vist };

  async function gem(aendringer: IndstillingAendringer, klientId: string = crypto.randomUUID()) {
    setVist((v) => ({ ...v, ...aendringer }));
    try {
      await opdaterIndstillinger(klientId, bodekasseId, aendringer);
    } catch (error) {
      setVist((v) => {
        const tilbage = { ...v };
        for (const noegle of Object.keys(aendringer)) delete tilbage[noegle as keyof IndstillingAendringer];
        return tilbage;
      });
      throw error;
    }
    hentet.reload();
    // The box name also lives on your Medlemskab (header, Skift Bødekasse).
    if ('navn' in aendringer) await reloadMedlemskaber();
  }

  return {
    status: hentet.status,
    error: hentet.status === 'error' ? hentet.error : null,
    reload: hentet.reload,
    indstillinger,
    pause: data?.pause ?? false,
    gem,
  };
}
