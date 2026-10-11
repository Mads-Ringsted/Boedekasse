-- #67: Sæson end, Pause and Start ny sæson.
--
-- The running Sæson and Pause are still computed at read time
-- (public.saeson_status / public.bodekasse_saeson): a Sæson ends at
-- Copenhagen midnight after its slutdato, or when `afsluttet` is set.
--
-- Public RPCs (Admin only):
--   afslut_saeson(klient_id, bodekasse)            "Afslut sæson nu"
--   start_saeson(klient_id, bodekasse)             "Start ny sæson"
--   saet_slutdato(klient_id, bodekasse, slutdato)  set, change or clear the end date
--   omdoeb_saeson(klient_id, bodekasse, navn)      rename the latest Sæson
--
-- Feed: 'saeson_afsluttet' {saeson_navn} in the ended Sæson (aktoer = the
-- Admin; null when it ended by date and the entry is written at the next
-- start), and 'saeson_startet' {saeson_navn} in the new Sæson.

-- Writes the "Sæson ended" feed entry for a Sæson, once.
create function private.saeson_afsluttet_haendelse(p_saeson uuid, p_aktoer uuid)
returns void
language plpgsql volatile security definer set search_path = '' as $$
declare v_saeson public.saeson;
begin
  select * into v_saeson from public.saeson where id = p_saeson;
  if exists (select 1 from public.haendelse
              where saeson_id = p_saeson and art = 'saeson_afsluttet') then
    return;
  end if;
  perform private.tilfoej_haendelse(
    v_saeson.bodekasse_id, p_aktoer, 'saeson_afsluttet',
    jsonb_build_object('saeson_navn', v_saeson.navn),
    'saeson', v_saeson.id, p_saeson => v_saeson.id);
end $$;

-- "Afslut sæson nu": ends the running Sæson at once. The box is in Pause.
-- Errors: ikke_admin, ikke_medlem, pause (no running Sæson).
create function public.afslut_saeson(p_klient_id uuid, p_bodekasse uuid)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_mig       uuid := private.mit_admin(p_bodekasse);
  v_tidligere jsonb;
  v_saeson    uuid;
begin
  v_tidligere := private.start_kald(p_klient_id, 'afslut_saeson');
  if v_tidligere is not null then return v_tidligere; end if;

  -- One Sæson change at a time per box.
  perform 1 from public.bodekasse where id = p_bodekasse for update;
  v_saeson := private.aktiv_saeson(p_bodekasse);
  if v_saeson is null then raise exception 'pause'; end if;

  update public.saeson set afsluttet = now() where id = v_saeson;
  perform private.saeson_afsluttet_haendelse(v_saeson, v_mig);
  return private.afslut_kald(p_klient_id, jsonb_build_object('saeson_id', v_saeson));
end $$;

-- "Start ny sæson": ends the running Sæson (if one runs) and starts the next,
-- named "Sæson <year>", in one step. No undo. Every open Anke closes as
-- ikke_afgjort (the receiver bears the Bøde). Medlemmer, roles,
-- Bødekategorier and settings are kept; Saldo and Kassen carry over (they sum
-- all Sæsoner), while per-Sæson figures and the feed start fresh.
-- Errors: ikke_admin, ikke_medlem.
create function public.start_saeson(p_klient_id uuid, p_bodekasse uuid)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_mig       uuid := private.mit_admin(p_bodekasse);
  v_tidligere jsonb;
  v_gammel    uuid;
  v_koerer    uuid;
  v_ny        uuid;
  v_navn      text := 'Sæson ' || extract(year from now() at time zone 'Europe/Copenhagen')::int;
begin
  v_tidligere := private.start_kald(p_klient_id, 'start_saeson');
  if v_tidligere is not null then return v_tidligere; end if;

  -- One Sæson change at a time per box.
  perform 1 from public.bodekasse where id = p_bodekasse for update;
  v_gammel := private.seneste_saeson(p_bodekasse);
  v_koerer := private.aktiv_saeson(p_bodekasse);

  if v_koerer is not null then
    update public.saeson set afsluttet = now() where id = v_koerer;
  end if;
  if v_gammel is not null then
    -- The Admin ended it now; one that ended by its date has no aktoer.
    perform private.saeson_afsluttet_haendelse(v_gammel, case when v_koerer is not null then v_mig end);
  end if;

  update public.anke a set afgoerelse = 'ikke_afgjort', afgjort = now()
    from public.bode b
   where a.bodekasse_id = p_bodekasse and a.afgoerelse is null
     and b.id = a.bode_id and b.annulleret is null;

  insert into public.saeson (bodekasse_id, navn) values (p_bodekasse, v_navn)
  returning id into v_ny;
  perform private.tilfoej_haendelse(
    p_bodekasse, v_mig, 'saeson_startet', jsonb_build_object('saeson_navn', v_navn),
    'saeson', v_ny, p_saeson => v_ny);
  return private.afslut_kald(p_klient_id, jsonb_build_object('saeson_id', v_ny, 'navn', v_navn));
end $$;

revoke execute on function private.saeson_afsluttet_haendelse(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.afslut_saeson(uuid, uuid) from public, anon;
grant execute on function public.afslut_saeson(uuid, uuid) to authenticated;
revoke execute on function public.start_saeson(uuid, uuid) from public, anon;
grant execute on function public.start_saeson(uuid, uuid) to authenticated;

-- Sets, changes or clears (null) the running Sæson's end date. It ends at
-- Copenhagen midnight after that date. Not in a Pause: start a new Sæson.
-- No feed entry. Errors: ikke_admin, ikke_medlem, pause, slutdato_ugyldig
-- (before today; use afslut_saeson to end it now).
create function public.saet_slutdato(p_klient_id uuid, p_bodekasse uuid, p_slutdato date)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_mig       uuid := private.mit_admin(p_bodekasse);
  v_tidligere jsonb;
  v_saeson    uuid;
begin
  v_tidligere := private.start_kald(p_klient_id, 'saet_slutdato');
  if v_tidligere is not null then return v_tidligere; end if;

  perform 1 from public.bodekasse where id = p_bodekasse for update;
  v_saeson := private.aktiv_saeson(p_bodekasse);
  if v_saeson is null then raise exception 'pause'; end if;
  if p_slutdato < (now() at time zone 'Europe/Copenhagen')::date then
    raise exception 'slutdato_ugyldig';
  end if;

  update public.saeson set slutdato = p_slutdato where id = v_saeson;
  return private.afslut_kald(p_klient_id, jsonb_build_object('saeson_id', v_saeson));
end $$;

-- Renames the latest Sæson (running or in a Pause; past ones are read-only).
-- No feed entry. Errors: ikke_admin, ikke_medlem, navn_mangler.
create function public.omdoeb_saeson(p_klient_id uuid, p_bodekasse uuid, p_navn text)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_mig       uuid := private.mit_admin(p_bodekasse);
  v_tidligere jsonb;
  v_saeson    uuid;
  v_navn      text := btrim(coalesce(p_navn, ''));
begin
  v_tidligere := private.start_kald(p_klient_id, 'omdoeb_saeson');
  if v_tidligere is not null then return v_tidligere; end if;
  if v_navn = '' then raise exception 'navn_mangler'; end if;

  v_saeson := private.seneste_saeson(p_bodekasse);
  update public.saeson set navn = v_navn where id = v_saeson;
  return private.afslut_kald(p_klient_id, jsonb_build_object('saeson_id', v_saeson, 'navn', v_navn));
end $$;

revoke execute on function public.saet_slutdato(uuid, uuid, date) from public, anon;
grant execute on function public.saet_slutdato(uuid, uuid, date) to authenticated;
revoke execute on function public.omdoeb_saeson(uuid, uuid, text) from public, anon;
grant execute on function public.omdoeb_saeson(uuid, uuid, text) to authenticated;
