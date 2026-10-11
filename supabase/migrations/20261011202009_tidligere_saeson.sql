-- #68: past Sæsoner are read-only.
--
-- Every write RPC that changes an existing record checks that the record
-- belongs to the box's latest Sæson with private.tjek_seneste_saeson (from
-- #59), which raises 'tidligere_saeson'. annuller_indbetaling already does.
-- fortryd_batch did not: a batch given seconds before "Start ny sæson" could
-- still be undone inside the old Sæson. It now checks too.
--
-- Payments toward old debt need nothing new: registrer_indbetaling (and
-- Betalingsmeldinger) always use the latest Sæson, and the old debt shows in
-- medlem_saeson_tal.overfoert.

-- ---------- fortryd_batch (from 20261011185646_giv_boeder.sql) ----------
-- Errors: ikke_fundet, ikke_medlem / ikke_tilladt (42501), tidligere_saeson,
-- fortryd_udloebet, kan_ikke_fortrydes.
create or replace function public.fortryd_batch(p_klient_id uuid, p_batch uuid)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_tidligere jsonb;
  v_bode      public.bode;
begin
  v_tidligere := private.start_kald(p_klient_id, 'fortryd_batch');
  if v_tidligere is not null then return v_tidligere; end if;

  select * into v_bode from public.bode where batch_id = p_batch order by givet limit 1;
  if v_bode.id is null then raise exception 'ikke_fundet'; end if;
  if private.mit_medlem(v_bode.bodekasse_id) <> v_bode.giver_id then
    raise exception 'ikke_tilladt' using errcode = '42501';
  end if;
  perform 1 from public.bode where batch_id = p_batch for update;
  perform private.tjek_seneste_saeson(v_bode.bodekasse_id, v_bode.saeson_id);
  if now() > v_bode.givet + private.fortryd_frist() then
    raise exception 'fortryd_udloebet';
  end if;

  begin
    delete from public.haendelse where batch_id = p_batch;
    delete from public.gebyr
     where bode_id in (select id from public.bode where batch_id = p_batch);
    delete from public.bode where batch_id = p_batch;
  exception when foreign_key_violation then
    raise exception 'kan_ikke_fortrydes';
  end;
  return private.afslut_kald(p_klient_id, jsonb_build_object('batch_id', p_batch));
end $$;
