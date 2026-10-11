import { kortNavne } from '../giv/navne.ts';
import { supabase } from '../supabase/index.ts';
import { minMelding, type Melding } from './betal.ts';

/** Every Betalingsmelding in the box that afventer, with the reporter's short name. */
export async function hentMeldinger(bodekasseId: string): Promise<Melding[]> {
  const [meldinger, medlemmer] = await Promise.all([
    supabase
      .from('betalingsmelding')
      .select('id, medlem_id, beloeb, meldt')
      .eq('bodekasse_id', bodekasseId)
      .eq('status', 'afventer'),
    supabase.from('medlem').select('id, navn').eq('bodekasse_id', bodekasseId),
  ]);
  if (meldinger.error) throw meldinger.error;
  if (medlemmer.error) throw medlemmer.error;
  // First names, unless two share one.
  const navne = new Map(kortNavne(medlemmer.data.map((m) => m.navn)).map((n, i) => [medlemmer.data[i]!.id, n]));
  return meldinger.data.map((m) => ({
    id: m.id,
    medlemId: m.medlem_id,
    navn: navne.get(m.medlem_id) ?? '',
    beloeb: m.beloeb,
    meldt: m.meldt,
  }));
}

export interface BetalData {
  /** Your Saldo; negative = Til gode. */
  saldo: number;
  /** The box's MobilePay Box number; null = not set (pay an Admin). */
  mobilepayBox: string | null;
  /** The active Admins' full names, for "Betal til en Admin". */
  admins: { id: string; navn: string }[];
  /** Your own report that afventer, if any. */
  minMelding: Melding | null;
}

const dansk = new Intl.Collator('da');

/** Everything the Betal sheet shows for you. */
export async function hentBetal(bodekasseId: string, medlemId: string): Promise<BetalData> {
  const [saldo, kasse, admins, meldinger] = await Promise.all([
    supabase.from('medlem_saldo').select('saldo').eq('medlem_id', medlemId).maybeSingle(),
    supabase.from('bodekasse').select('mobilepay_box').eq('id', bodekasseId).maybeSingle(),
    supabase.from('medlem').select('id, navn').eq('bodekasse_id', bodekasseId).eq('er_admin', true).is('udmeldt', null),
    hentMeldinger(bodekasseId),
  ]);
  if (saldo.error) throw saldo.error;
  if (kasse.error) throw kasse.error;
  if (admins.error) throw admins.error;
  return {
    saldo: saldo.data?.saldo ?? 0,
    mobilepayBox: kasse.data?.mobilepay_box?.trim() || null,
    admins: admins.data.sort((a, b) => dansk.compare(a.navn, b.navn)),
    minMelding: minMelding(meldinger, medlemId),
  };
}

const kald = async (svar: PromiseLike<{ error: unknown }>) => {
  const { error } = await svar;
  if (error) throw error;
};

/** "Jeg har betalt": report that you paid `beloeb` kr. */
export const meldBetaling = (klientId: string, bodekasseId: string, beloeb: number) =>
  kald(supabase.rpc('meld_betaling', { p_klient_id: klientId, p_bodekasse: bodekasseId, p_beloeb: beloeb }));

/** Withdraw your own report while it afventer. */
export const fortrydBetalingsmelding = (klientId: string, meldingId: string) =>
  kald(supabase.rpc('fortryd_betalingsmelding', { p_klient_id: klientId, p_melding: meldingId }));

/** Confirm (creates the Indbetaling) or reject someone's report. */
export const behandlBetalingsmelding = (klientId: string, meldingId: string, bekraeft: boolean) =>
  kald(
    supabase.rpc('behandl_betalingsmelding', { p_klient_id: klientId, p_melding: meldingId, p_bekraeft: bekraeft }),
  );
