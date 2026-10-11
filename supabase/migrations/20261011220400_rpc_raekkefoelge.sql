-- Review fix: every write RPC follows the spec's step order.
--
-- These RPCs looked at the one-time ID before resolving the caller. Like the
-- other RPCs, they now (1) resolve the caller's Medlem (rejecting an Udmeldt
-- or non-Medlem), then (4) ignore a repeat of the same one-time ID, then
-- (2) check their rules and (3) write. Bodies are otherwise unchanged
-- (each copied from its latest definition, named above it).
--
-- fortryd_batch and slet_bodekasse delete their target, so a repeat finds
-- nothing to resolve the caller against: when the target is gone they look
-- up the one-time ID first and return the first answer, else fail as before.

-- ---------- annuller_bode (from 20261011200712_annuller_boeder.sql) ----------
create or replace function public.annuller_bode(
  p_klient_id uuid, p_bode uuid, p_note text default null)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_note      text := nullif(btrim(p_note), '');
  v_bode      public.bode;
  v_mig       uuid;
  v_admin     boolean;
  v_gebyr     int;
  v_tidligere jsonb;
begin
  select * into v_bode from public.bode where id = p_bode for update;
  if v_bode.id is null then raise exception 'ikke_fundet'; end if;
  v_mig := private.mit_medlem(v_bode.bodekasse_id);
  v_tidligere := private.start_kald(p_klient_id, 'annuller_bode');
  if v_tidligere is not null then return v_tidligere; end if;

  select er_admin into v_admin from public.medlem where id = v_mig;
  if not v_admin then
    if v_bode.giver_id is distinct from v_mig then
      raise exception 'ikke_tilladt' using errcode = '42501';
    end if;
    if exists (select 1 from public.anke where bode_id = v_bode.id) then
      raise exception 'anket';
    end if;
  end if;
  if v_bode.annulleret is not null then raise exception 'allerede_annulleret'; end if;
  perform private.tjek_seneste_saeson(v_bode.bodekasse_id, v_bode.saeson_id);

  update public.bode
     set annulleret = now(), annulleret_af = v_mig, annulleret_note = v_note
   where id = v_bode.id;

  with annulleret as (
    update public.gebyr
       set annulleret = now(), annulleret_af = v_mig, annulleret_note = v_note
     where bode_id = v_bode.id and art = 'engangsbode' and annulleret is null
    returning beloeb
  )
  select coalesce(sum(beloeb), 0)::int into v_gebyr from annulleret;

  perform private.tilfoej_haendelse(
    v_bode.bodekasse_id, v_mig, 'bode_annulleret',
    jsonb_build_object(
      'bode_id', v_bode.id,
      'giver_id', v_bode.giver_id,
      'giver_navn', (select navn from public.medlem where id = v_bode.giver_id),
      'navn', coalesce((select navn from public.bodekategori where id = v_bode.bodekategori_id), v_bode.grund),
      'pris', v_bode.pris,
      'engangsbode', v_bode.bodekategori_id is null,
      'gebyr', v_gebyr,
      'note', v_note),
    p_modtager => v_bode.modtager_id, p_saeson => v_bode.saeson_id);

  return private.afslut_kald(p_klient_id, jsonb_build_object('bode_id', v_bode.id));
end $$;

-- ---------- annuller_gebyr (from 20261011200712_annuller_boeder.sql) ----------
create or replace function public.annuller_gebyr(
  p_klient_id uuid, p_gebyr uuid, p_note text default null)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_note      text := nullif(btrim(p_note), '');
  v_gebyr     public.gebyr;
  v_mig       uuid;
  v_navn      text;
  v_tidligere jsonb;
begin
  select * into v_gebyr from public.gebyr where id = p_gebyr for update;
  if v_gebyr.id is null then raise exception 'ikke_fundet'; end if;
  v_mig := private.mit_admin(v_gebyr.bodekasse_id);
  v_tidligere := private.start_kald(p_klient_id, 'annuller_gebyr');
  if v_tidligere is not null then return v_tidligere; end if;

  if v_gebyr.art not in ('oprettelse', 'anke') then raise exception 'kan_ikke_annulleres'; end if;
  if v_gebyr.annulleret is not null then raise exception 'allerede_annulleret'; end if;
  perform private.tjek_seneste_saeson(v_gebyr.bodekasse_id, v_gebyr.saeson_id);

  update public.gebyr
     set annulleret = now(), annulleret_af = v_mig, annulleret_note = v_note
   where id = v_gebyr.id;

  if v_gebyr.art = 'oprettelse' then
    select navn into v_navn from public.bodekategori where id = v_gebyr.bodekategori_id;
  else
    select coalesce(k.navn, b.grund) into v_navn
      from public.anke a
      join public.bode b on b.id = a.bode_id
      left join public.bodekategori k on k.id = b.bodekategori_id
     where a.id = v_gebyr.anke_id;
  end if;

  perform private.tilfoej_haendelse(
    v_gebyr.bodekasse_id, v_mig, 'gebyr_annulleret',
    jsonb_build_object('gebyr_id', v_gebyr.id, 'art', v_gebyr.art, 'navn', v_navn,
                       'beloeb', v_gebyr.beloeb, 'note', v_note),
    p_modtager => v_gebyr.medlem_id, p_saeson => v_gebyr.saeson_id);

  return private.afslut_kald(p_klient_id, jsonb_build_object('gebyr_id', v_gebyr.id));
end $$;

-- ---------- annuller_frikob (from 20261011200352_frikoeb.sql) ----------
create or replace function public.annuller_frikob(p_klient_id uuid, p_frikob uuid, p_note text default null)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_note      text := nullif(btrim(p_note), '');
  v_frikob    public.frikob;
  v_mig       uuid;
  v_beloeb    int;
  v_tidligere jsonb;
begin
  select * into v_frikob from public.frikob where id = p_frikob for update;
  if v_frikob.id is null then raise exception 'ikke_fundet'; end if;
  v_mig := private.mit_admin(v_frikob.bodekasse_id);
  v_tidligere := private.start_kald(p_klient_id, 'annuller_frikob');
  if v_tidligere is not null then return v_tidligere; end if;

  if v_frikob.annulleret is not null then raise exception 'allerede_annulleret'; end if;
  perform private.tjek_seneste_saeson(v_frikob.bodekasse_id, v_frikob.saeson_id);

  update public.frikob
     set annulleret = now(), annulleret_af = v_mig, annulleret_note = v_note
   where id = v_frikob.id;
  update public.gebyr
     set annulleret = now(), annulleret_af = v_mig, annulleret_note = v_note
   where frikob_id = v_frikob.id and annulleret is null
  returning beloeb into v_beloeb;

  perform private.tilfoej_haendelse(
    v_frikob.bodekasse_id, v_mig, 'frikob_annulleret',
    jsonb_build_object('frikob_id', v_frikob.id,
                       'navn', (select navn from public.bodekategori where id = v_frikob.bodekategori_id),
                       'beloeb', coalesce(v_beloeb, 0), 'note', v_note),
    p_modtager => v_frikob.medlem_id, p_saeson => v_frikob.saeson_id);

  return private.afslut_kald(p_klient_id, jsonb_build_object('frikob_id', v_frikob.id));
end $$;

-- ---------- annuller_haevning (from 20261011195232_haev_penge.sql) ----------
create or replace function public.annuller_haevning(
  p_klient_id uuid, p_haevning uuid, p_note text default null)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_note      text := nullif(btrim(p_note), '');
  v_h         public.haevning;
  v_mig       uuid;
  v_tidligere jsonb;
begin
  select * into v_h from public.haevning where id = p_haevning for update;
  if v_h.id is null then raise exception 'ikke_fundet'; end if;
  v_mig := private.mit_admin(v_h.bodekasse_id);
  v_tidligere := private.start_kald(p_klient_id, 'annuller_haevning');
  if v_tidligere is not null then return v_tidligere; end if;

  if v_h.annulleret is not null then raise exception 'allerede_annulleret'; end if;
  perform private.tjek_seneste_saeson(v_h.bodekasse_id, v_h.saeson_id);

  update public.haevning
     set annulleret = now(), annulleret_af = v_mig, annulleret_note = v_note
   where id = v_h.id;

  perform private.tilfoej_haendelse(
    v_h.bodekasse_id, v_mig, 'haevning_annulleret',
    jsonb_build_object('haevning_id', v_h.id, 'beloeb', v_h.beloeb,
                       'formaal', v_h.formaal, 'note', v_note));

  return private.afslut_kald(p_klient_id, jsonb_build_object('haevning_id', v_h.id));
end $$;

-- ---------- annuller_indbetaling (from 20261011193206_kassen.sql) ----------
create or replace function public.annuller_indbetaling(
  p_klient_id uuid, p_indbetaling uuid, p_note text default null)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_note      text := nullif(btrim(p_note), '');
  v_ind       public.indbetaling;
  v_mig       uuid;
  v_navn      text;
  v_tidligere jsonb;
begin
  select * into v_ind from public.indbetaling where id = p_indbetaling for update;
  if v_ind.id is null then raise exception 'ikke_fundet'; end if;
  v_mig := private.mit_admin(v_ind.bodekasse_id);
  v_tidligere := private.start_kald(p_klient_id, 'annuller_indbetaling');
  if v_tidligere is not null then return v_tidligere; end if;

  if v_ind.annulleret is not null then raise exception 'allerede_annulleret'; end if;
  perform private.tjek_seneste_saeson(v_ind.bodekasse_id, v_ind.saeson_id);

  update public.indbetaling
     set annulleret = now(), annulleret_af = v_mig, annulleret_note = v_note
   where id = v_ind.id;

  select navn into v_navn from public.medlem where id = v_ind.medlem_id;
  perform private.tilfoej_haendelse(
    v_ind.bodekasse_id, v_mig, 'indbetaling_annulleret',
    jsonb_build_object('indbetaling_id', v_ind.id, 'navn', v_navn,
                       'beloeb', v_ind.beloeb, 'note', v_note),
    p_modtager => v_ind.medlem_id);

  return private.afslut_kald(p_klient_id, jsonb_build_object('indbetaling_id', v_ind.id));
end $$;

-- ---------- fortryd_betalingsmelding (from 20261011195426_betalingsmelding.sql) ----------
create or replace function public.fortryd_betalingsmelding(p_klient_id uuid, p_melding uuid)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_melding   public.betalingsmelding;
  v_mig       uuid;
  v_tidligere jsonb;
begin
  select * into v_melding from public.betalingsmelding where id = p_melding for update;
  if v_melding.id is null then raise exception 'ikke_fundet'; end if;
  v_mig := private.mit_medlem(v_melding.bodekasse_id);
  v_tidligere := private.start_kald(p_klient_id, 'fortryd_betalingsmelding');
  if v_tidligere is not null then return v_tidligere; end if;

  if v_melding.medlem_id <> v_mig then raise exception 'ikke_din_melding'; end if;
  if v_melding.status <> 'afventer' then raise exception 'ikke_afventer'; end if;

  update public.betalingsmelding
     set status = 'trukket', behandlet = now(), behandlet_af = v_mig
   where id = v_melding.id;

  return private.afslut_kald(p_klient_id, jsonb_build_object('betalingsmelding_id', v_melding.id));
end $$;

-- ---------- behandl_betalingsmelding (from 20261011195426_betalingsmelding.sql) ----------
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
  select * into v_melding from public.betalingsmelding where id = p_melding for update;
  if v_melding.id is null then raise exception 'ikke_fundet'; end if;
  v_mig := private.mit_medlem(v_melding.bodekasse_id);
  v_tidligere := private.start_kald(p_klient_id, 'behandl_betalingsmelding');
  if v_tidligere is not null then return v_tidligere; end if;

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

-- ---------- fortryd_batch (from 20261011202009_tidligere_saeson.sql) ----------
create or replace function public.fortryd_batch(p_klient_id uuid, p_batch uuid)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_tidligere jsonb;
  v_bode      public.bode;
  v_mig       uuid;
begin
  select * into v_bode from public.bode where batch_id = p_batch order by givet limit 1;
  if v_bode.id is null then
    -- Gone: a repeat of an undo that went through gets its first answer.
    v_tidligere := private.start_kald(p_klient_id, 'fortryd_batch');
    if v_tidligere is not null then return v_tidligere; end if;
    raise exception 'ikke_fundet';
  end if;
  v_mig := private.mit_medlem(v_bode.bodekasse_id);
  v_tidligere := private.start_kald(p_klient_id, 'fortryd_batch');
  if v_tidligere is not null then return v_tidligere; end if;

  if v_mig <> v_bode.giver_id then
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

-- ---------- slet_bodekasse (from 20261011204031_slet_bodekasse_konto.sql) ----------
create or replace function public.slet_bodekasse(p_klient_id uuid, p_bodekasse uuid, p_navn text)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_tidligere jsonb;
  v_navn      text;
begin
  if not exists (select 1 from public.bodekasse where id = p_bodekasse) then
    -- Gone: a repeat of a delete that went through gets its first answer.
    v_tidligere := private.start_kald(p_klient_id, 'slet_bodekasse');
    if v_tidligere is not null then return v_tidligere; end if;
  end if;
  perform private.mit_admin(p_bodekasse);
  v_tidligere := private.start_kald(p_klient_id, 'slet_bodekasse');
  if v_tidligere is not null then return v_tidligere; end if;
  select navn into v_navn from public.bodekasse where id = p_bodekasse for update;
  if btrim(coalesce(p_navn, '')) is distinct from v_navn then
    raise exception 'navn_passer_ikke';
  end if;
  delete from public.bodekasse where id = p_bodekasse;
  return private.afslut_kald(p_klient_id, '{}'::jsonb);
end $$;
