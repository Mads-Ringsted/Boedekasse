import { supabase } from '../supabase/index.ts';
import type { SletGrund } from './adminHandlinger.ts';

export interface AdminData {
  email: string | null;
  /** Why Slet is disabled; null = it can go ahead. */
  sletGrund: SletGrund | null;
}

/** What the Admin actions sheet needs beyond the profile: the email and the Slet rule. */
export async function hentAdminData(bodekasseId: string, medlemId: string): Promise<AdminData> {
  const [medlem, slet] = await Promise.all([
    supabase.from('medlem').select('email').eq('bodekasse_id', bodekasseId).eq('id', medlemId).maybeSingle(),
    supabase.from('medlem_slet_grund').select('grund').eq('medlem_id', medlemId).maybeSingle(),
  ]);
  if (medlem.error) throw medlem.error;
  if (slet.error) throw slet.error;
  return { email: medlem.data?.email ?? null, sletGrund: (slet.data?.grund ?? null) as SletGrund | null };
}
