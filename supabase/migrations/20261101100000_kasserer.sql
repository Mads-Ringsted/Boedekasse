-- #75 (spec #74): the Kasserer role and money permissions.
--
-- A Kasserer is a Medlem an Admin has given money powers without making them
-- Admin. "May handle money" = an active Medlem who is Admin or Kasserer
-- (private.mine_penge). These move from Admin-only to "may handle money":
-- registrer_indbetaling, annuller_indbetaling, haev, annuller_haevning.
-- behandl_betalingsmelding narrows from any Medlem to "may handle money"
-- (the accepted behaviour change in spec #74); the egen_melding rule stays:
-- only an Admin handles their own report.
-- No "last Kasserer" guard: Admins always hold the powers.
-- Additive: one column defaulting to false; RPC names and arguments unchanged.

alter table public.medlem add column er_kasserer boolean not null default false;

-- ---------- Shared helper ----------

-- Like mit_medlem, but the caller must also be allowed to handle money: an
-- Admin or a Kasserer. mit_medlem already rejects an Udmeldt.
-- Errors: ikke_medlem / ikke_kasserer (42501).
create function private.mine_penge(p_bodekasse uuid) returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare v_id uuid := private.mit_medlem(p_bodekasse);
begin
  if not exists (select 1 from public.medlem where id = v_id and (er_admin or er_kasserer)) then
    raise exception 'ikke_kasserer' using errcode = '42501';
  end if;
  return v_id;
end $$;

-- ---------- Gør til Kasserer / Fjern som Kasserer ----------
-- Any Admin gives or takes the Kasserer role on any active Medlem, their own
-- included. No feed entry (like saet_admin). Returns {"er_kasserer": bool}.
-- Errors: ikke_medlem / ikke_admin (42501), medlem_ukendt, medlem_udmeldt.
create function public.saet_kasserer(p_klient_id uuid, p_bodekasse uuid, p_medlem uuid, p_er_kasserer boolean)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_mig       uuid := private.mit_admin(p_bodekasse);
  v_tidligere jsonb;
  v_medlem    public.medlem;
begin
  v_tidligere := private.start_kald(p_klient_id, 'saet_kasserer');
  if v_tidligere is not null then return v_tidligere; end if;
  v_medlem := private.medlem_i_kassen(p_bodekasse, p_medlem);
  if v_medlem.udmeldt is not null then raise exception 'medlem_udmeldt'; end if;
  update public.medlem set er_kasserer = coalesce(p_er_kasserer, false) where id = p_medlem;
  return private.afslut_kald(p_klient_id, jsonb_build_object('er_kasserer', coalesce(p_er_kasserer, false)));
end $$;

revoke execute on function public.saet_kasserer(uuid, uuid, uuid, boolean) from public, anon;
grant execute on function public.saet_kasserer(uuid, uuid, uuid, boolean) to authenticated;

-- ---------- udmeld (from 20261011200145_medlem_admin.sql) ----------
-- Now also takes the Kasserer role, like the Admin role: Genoptag brings them
-- back as a plain Medlem.
create or replace function public.udmeld(p_klient_id uuid, p_bodekasse uuid, p_medlem uuid)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_mig       uuid := private.mit_admin(p_bodekasse);
  v_tidligere jsonb;
  v_medlem    public.medlem;
begin
  v_tidligere := private.start_kald(p_klient_id, 'udmeld');
  if v_tidligere is not null then return v_tidligere; end if;
  v_medlem := private.medlem_i_kassen(p_bodekasse, p_medlem);
  if v_medlem.udmeldt is not null then raise exception 'medlem_udmeldt'; end if;
  if v_medlem.id = v_mig then raise exception 'melder_dig_selv_ud'; end if;
  perform private.tjek_ikke_sidste_admin(p_bodekasse, p_medlem);

  update public.medlem set udmeldt = now(), er_admin = false, er_kasserer = false where id = p_medlem;
  perform private.tilfoej_haendelse(
    p_bodekasse, v_mig, 'medlem_udmeldt', jsonb_build_object('navn', v_medlem.navn),
    'medlem', p_medlem, p_modtager => p_medlem);
  return private.afslut_kald(p_klient_id, '{}'::jsonb);
end $$;

-- ---------- registrer_indbetaling (from 20261011193206_kassen.sql) ----------
-- Errors now: ikke_medlem / ikke_kasserer (42501), medlem_ukendt, beloeb_ugyldig.
-- Feed aktoer = the Admin or Kasserer.
create or replace function public.registrer_indbetaling(
  p_klient_id uuid, p_bodekasse uuid, p_medlem uuid, p_beloeb int, p_note text default null)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_mig       uuid := private.mine_penge(p_bodekasse);
  v_note      text := nullif(btrim(p_note), '');
  v_navn      text;
  v_tidligere jsonb;
  v_ny        uuid;
begin
  v_tidligere := private.start_kald(p_klient_id, 'registrer_indbetaling');
  if v_tidligere is not null then return v_tidligere; end if;

  select navn into v_navn from public.medlem
   where id = p_medlem and bodekasse_id = p_bodekasse;
  if v_navn is null then raise exception 'medlem_ukendt'; end if;
  if p_beloeb is null or p_beloeb <= 0 then raise exception 'beloeb_ugyldig'; end if;

  insert into public.indbetaling (bodekasse_id, saeson_id, medlem_id, beloeb, note, registreret_af)
  values (p_bodekasse, private.seneste_saeson(p_bodekasse), p_medlem, p_beloeb, v_note, v_mig)
  returning id into v_ny;

  perform private.tilfoej_haendelse(
    p_bodekasse, v_mig, 'indbetaling',
    jsonb_build_object('navn', v_navn, 'beloeb', p_beloeb, 'note', v_note),
    'indbetaling', v_ny, p_modtager => p_medlem);

  return private.afslut_kald(p_klient_id, jsonb_build_object('indbetaling_id', v_ny));
end $$;

-- ---------- annuller_indbetaling (from 20261011220400_rpc_raekkefoelge.sql) ----------
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
  v_mig := private.mine_penge(v_ind.bodekasse_id);
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

-- ---------- haev (from 20261011195232_haev_penge.sql) ----------
create or replace function public.haev(
  p_klient_id uuid, p_bodekasse uuid, p_beloeb int, p_formaal text)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_mig       uuid := private.mine_penge(p_bodekasse);
  v_formaal   text := nullif(btrim(p_formaal), '');
  v_kassen    int;
  v_tidligere jsonb;
  v_ny        uuid;
begin
  v_tidligere := private.start_kald(p_klient_id, 'haev');
  if v_tidligere is not null then return v_tidligere; end if;

  if p_beloeb is null or p_beloeb <= 0 then raise exception 'beloeb_ugyldig'; end if;
  if v_formaal is null then raise exception 'formaal_mangler'; end if;

  -- Lock the box, then read Kassen: concurrent Hævninger queue up here.
  perform 1 from public.bodekasse where id = p_bodekasse for update;
  select beloeb into v_kassen from public.kassen where bodekasse_id = p_bodekasse;
  if p_beloeb > coalesce(v_kassen, 0) then raise exception 'over_kassen'; end if;

  insert into public.haevning (bodekasse_id, saeson_id, beloeb, formaal, registreret_af)
  values (p_bodekasse, private.seneste_saeson(p_bodekasse), p_beloeb, v_formaal, v_mig)
  returning id into v_ny;

  perform private.tilfoej_haendelse(
    p_bodekasse, v_mig, 'haevning',
    jsonb_build_object('beloeb', p_beloeb, 'formaal', v_formaal),
    'haevning', v_ny);

  return private.afslut_kald(p_klient_id, jsonb_build_object('haevning_id', v_ny));
end $$;

-- ---------- annuller_haevning (from 20261011220400_rpc_raekkefoelge.sql) ----------
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
  v_mig := private.mine_penge(v_h.bodekasse_id);
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

-- ---------- behandl_betalingsmelding (from 20261011220400_rpc_raekkefoelge.sql) ----------
-- Only Admins and Kasserere; nobody handles their own report except an Admin.
-- Errors now: ikke_medlem / ikke_kasserer (42501), ikke_fundet, egen_melding,
-- ikke_afventer.
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
  v_mig := private.mine_penge(v_melding.bodekasse_id);
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
