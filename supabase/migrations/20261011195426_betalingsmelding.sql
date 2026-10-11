-- #60: Betal sheet and Betalingsmelding.
--
-- A Medlem reports "Jeg har betalt" (meld_betaling). It afventer until
-- another Medlem confirms or rejects it (behandl_betalingsmelding); an Admin
-- may handle their own. Confirming creates the Indbetaling with the reported
-- amount. The reporter can withdraw it while it afventer
-- (fortryd_betalingsmelding). No feed entry while it afventer.
-- All three work in a Pause and use the latest Sæson.
-- Written with `create or replace` so the file can be re-applied by hand.

-- ---------- Reporting ----------

-- The caller reports that they paid p_beloeb kr. One report afventer per
-- Medlem at a time. Returns {"betalingsmelding_id": uuid}.
-- Errors: ikke_medlem (42501), beloeb_ugyldig, melding_afventer.
create or replace function public.meld_betaling(p_klient_id uuid, p_bodekasse uuid, p_beloeb int)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_mig       uuid := private.mit_medlem(p_bodekasse);
  v_tidligere jsonb;
  v_ny        uuid;
begin
  v_tidligere := private.start_kald(p_klient_id, 'meld_betaling');
  if v_tidligere is not null then return v_tidligere; end if;

  if p_beloeb is null or p_beloeb <= 0 then raise exception 'beloeb_ugyldig'; end if;
  -- Lock my Medlem row, so two quick taps can't both pass the check below.
  perform 1 from public.medlem where id = v_mig for update;
  if exists (select 1 from public.betalingsmelding
              where medlem_id = v_mig and status = 'afventer') then
    raise exception 'melding_afventer';
  end if;

  insert into public.betalingsmelding (bodekasse_id, saeson_id, medlem_id, beloeb)
  values (p_bodekasse, private.seneste_saeson(p_bodekasse), v_mig, p_beloeb)
  returning id into v_ny;

  return private.afslut_kald(p_klient_id, jsonb_build_object('betalingsmelding_id', v_ny));
end $$;

revoke execute on function public.meld_betaling(uuid, uuid, int) from public, anon;
grant execute on function public.meld_betaling(uuid, uuid, int) to authenticated;

-- ---------- Withdrawing ----------

-- The reporter withdraws their report while it afventer (status 'trukket').
-- Returns {"betalingsmelding_id": uuid}. No feed entry.
-- Errors: ikke_medlem (42501), ikke_fundet, ikke_din_melding, ikke_afventer.
create or replace function public.fortryd_betalingsmelding(p_klient_id uuid, p_melding uuid)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_melding   public.betalingsmelding;
  v_mig       uuid;
  v_tidligere jsonb;
begin
  v_tidligere := private.start_kald(p_klient_id, 'fortryd_betalingsmelding');
  if v_tidligere is not null then return v_tidligere; end if;

  select * into v_melding from public.betalingsmelding where id = p_melding for update;
  if v_melding.id is null then raise exception 'ikke_fundet'; end if;
  v_mig := private.mit_medlem(v_melding.bodekasse_id);
  if v_melding.medlem_id <> v_mig then raise exception 'ikke_din_melding'; end if;
  if v_melding.status <> 'afventer' then raise exception 'ikke_afventer'; end if;

  update public.betalingsmelding
     set status = 'trukket', behandlet = now(), behandlet_af = v_mig
   where id = v_melding.id;

  return private.afslut_kald(p_klient_id, jsonb_build_object('betalingsmelding_id', v_melding.id));
end $$;

revoke execute on function public.fortryd_betalingsmelding(uuid, uuid) from public, anon;
grant execute on function public.fortryd_betalingsmelding(uuid, uuid) to authenticated;

-- ---------- Confirming or rejecting ----------

-- Any active Medlem of the box confirms (p_bekraeft = true) or rejects a
-- report that afventer. The reporter may only if they are an Admin. The
-- amount can't change: confirming creates one Indbetaling with the reported
-- amount, registered by the confirmer, in the latest Sæson.
-- Returns {"betalingsmelding_id": uuid, "indbetaling_id": uuid | null}.
-- Errors: ikke_medlem (42501), ikke_fundet, egen_melding, ikke_afventer.
-- Feed (aktoer = who handled it, modtager = the reporter, data {navn, beloeb}):
--   confirmed: art 'betaling_bekraeftet', ref indbetaling (an annulment strikes it);
--   rejected:  art 'betaling_afvist', no ref.
create or replace function public.behandl_betalingsmelding(p_klient_id uuid, p_melding uuid, p_bekraeft boolean)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_melding   public.betalingsmelding;
  v_mig       uuid;
  v_navn      text;
  v_ind       uuid;
  v_tidligere jsonb;
begin
  v_tidligere := private.start_kald(p_klient_id, 'behandl_betalingsmelding');
  if v_tidligere is not null then return v_tidligere; end if;

  select * into v_melding from public.betalingsmelding where id = p_melding for update;
  if v_melding.id is null then raise exception 'ikke_fundet'; end if;
  v_mig := private.mit_medlem(v_melding.bodekasse_id);
  if v_melding.medlem_id = v_mig
     and not exists (select 1 from public.medlem where id = v_mig and er_admin) then
    raise exception 'egen_melding';
  end if;
  if v_melding.status <> 'afventer' then raise exception 'ikke_afventer'; end if;

  update public.betalingsmelding
     set status = case when p_bekraeft then 'bekraeftet' else 'afvist' end::public.melding_status,
         behandlet = now(), behandlet_af = v_mig
   where id = v_melding.id;

  select navn into v_navn from public.medlem where id = v_melding.medlem_id;

  if p_bekraeft then
    insert into public.indbetaling (bodekasse_id, saeson_id, medlem_id, beloeb,
                                    registreret_af, betalingsmelding_id)
    values (v_melding.bodekasse_id, private.seneste_saeson(v_melding.bodekasse_id),
            v_melding.medlem_id, v_melding.beloeb, v_mig, v_melding.id)
    returning id into v_ind;

    perform private.tilfoej_haendelse(
      v_melding.bodekasse_id, v_mig, 'betaling_bekraeftet',
      jsonb_build_object('navn', v_navn, 'beloeb', v_melding.beloeb),
      'indbetaling', v_ind, p_modtager => v_melding.medlem_id);
  else
    perform private.tilfoej_haendelse(
      v_melding.bodekasse_id, v_mig, 'betaling_afvist',
      jsonb_build_object('navn', v_navn, 'beloeb', v_melding.beloeb),
      p_modtager => v_melding.medlem_id);
  end if;

  return private.afslut_kald(p_klient_id,
    jsonb_build_object('betalingsmelding_id', v_melding.id, 'indbetaling_id', v_ind));
end $$;

revoke execute on function public.behandl_betalingsmelding(uuid, uuid, boolean) from public, anon;
grant execute on function public.behandl_betalingsmelding(uuid, uuid, boolean) to authenticated;
