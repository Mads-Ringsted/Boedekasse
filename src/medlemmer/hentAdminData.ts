import { hentFrikobStatus, type FrikobStatus } from '../frikob/hentFrikoeb.ts';
import { supabase } from '../supabase/index.ts';
import type { SletGrund } from './adminHandlinger.ts';

export interface AdminData {
  email: string | null;
  /** Why Slet is disabled; null = it can go ahead. */
  sletGrund: SletGrund | null;
  /** The Medlem's Frikøb status, for Registrér frikøb. */
  frikob: FrikobStatus;
}

/** What the Admin actions sheet needs beyond the profile: the email, the Slet rule and Frikøb. */
export async function hentAdminData(bodekasseId: string, medlemId: string): Promise<AdminData> {
  const [medlem, slet, frikob] = await Promise.all([
    supabase.from('medlem').select('email').eq('bodekasse_id', bodekasseId).eq('id', medlemId).maybeSingle(),
    supabase.from('medlem_slet_grund').select('grund').eq('medlem_id', medlemId).maybeSingle(),
    hentFrikobStatus(bodekasseId, medlemId),
  ]);
  if (medlem.error) throw medlem.error;
  if (slet.error) throw slet.error;
  return {
    email: medlem.data?.email ?? null,
    sletGrund: (slet.data?.grund ?? null) as SletGrund | null,
    frikob,
  };
}
