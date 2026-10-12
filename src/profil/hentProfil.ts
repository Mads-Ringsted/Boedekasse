import { hentSenesteSaeson } from '../aktivitet/hentAktivitet.ts';
import { supabase } from '../supabase/index.ts';
import type { Profil } from './profil.ts';

/**
 * One Medlem's profile: who they are, their Saldo (all Sæsoner) and the
 * latest Sæson's Bøder og gebyrer, Betalt (the Topliste's figures) and Overført.
 * Null when the Medlem is not in this box. Udmeldte are found too.
 */
export async function hentProfil(bodekasseId: string, medlemId: string): Promise<Profil | null> {
  const [medlem, saldo, saesonId] = await Promise.all([
    supabase
      .from('medlem')
      .select('id, navn, er_admin, user_id, udmeldt, konto_slettet')
      .eq('bodekasse_id', bodekasseId)
      .eq('id', medlemId)
      .maybeSingle(),
    supabase.from('medlem_saldo').select('saldo').eq('medlem_id', medlemId).maybeSingle(),
    hentSenesteSaeson(bodekasseId),
  ]);
  if (medlem.error) throw medlem.error;
  if (saldo.error) throw saldo.error;
  if (!medlem.data) return null;

  let tal = { boeder_i_alt: 0, indbetalt: 0, overfoert: 0 };
  if (saesonId) {
    const svar = await supabase
      .from('medlem_saeson_tal')
      .select('boeder_i_alt, indbetalt, overfoert')
      .eq('saeson_id', saesonId)
      .eq('medlem_id', medlemId)
      .maybeSingle();
    if (svar.error) throw svar.error;
    tal = {
      boeder_i_alt: svar.data?.boeder_i_alt ?? 0,
      indbetalt: svar.data?.indbetalt ?? 0,
      overfoert: svar.data?.overfoert ?? 0,
    };
  }

  const m = medlem.data;
  return {
    id: m.id,
    navn: m.navn,
    erAdmin: m.er_admin,
    loggetInd: m.user_id !== null,
    kontoSlettet: m.konto_slettet !== null,
    udmeldt: m.udmeldt !== null,
    saldo: saldo.data?.saldo ?? 0,
    boederOgGebyrer: tal.boeder_i_alt,
    betalt: tal.indbetalt,
    overfoert: tal.overfoert,
  };
}
