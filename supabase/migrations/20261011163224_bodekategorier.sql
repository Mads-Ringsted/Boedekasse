-- #52: Bødekategorier. Any Medlem creates one; its creator or an Admin edits
-- it for free, archives it and brings it back. Never deleted.
-- A name is unique among the box's active Bødekategorier (case-insensitive);
-- an archived name is free to reuse. No creation Gebyr yet (#57).
--
-- Feed (haendelse, ref_tabel 'bodekategori', ref_id = the Bødekategori):
--   bodekategori_oprettet   data {navn, pris}
--   bodekategori_ompriset   data {navn, gammel_pris, ny_pris}   (price changed)
--   bodekategori_arkiveret  data {navn, pris}
-- Name/description edits and bringing one back add no entry (spec: Aktivitet).

-- The trimmed name, or kategorinavn_mangler.
create function private.bodekategori_navn(p_navn text) returns text
language plpgsql immutable set search_path = '' as $$
declare v_navn text := btrim(coalesce(p_navn, ''));
begin
  if v_navn = '' then raise exception 'kategorinavn_mangler'; end if;
  return v_navn;
end $$;

-- A price is whole kroner above 0.
create function private.tjek_pris(p_pris int) returns void
language plpgsql immutable set search_path = '' as $$
begin
  if p_pris is null or p_pris <= 0 then raise exception 'pris_ugyldig'; end if;
end $$;

-- Rejects a name already used by another active Bødekategori in the box.
create function private.tjek_ledigt_navn(p_bodekasse uuid, p_navn text, p_undtagen uuid default null)
returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if exists (select 1 from public.bodekategori
              where bodekasse_id = p_bodekasse and arkiveret is null
                and lower(navn) = lower(p_navn)
                and id is distinct from p_undtagen) then
    raise exception 'navn_findes';
  end if;
end $$;

-- Locks a Bødekategori and checks the caller is its creator or an Admin.
-- Returns the row; rejects an unknown id or another box's (ikke_fundet).
create function private.min_bodekategori(p_bodekategori uuid) returns public.bodekategori
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_k   public.bodekategori;
  v_mig uuid;
begin
  select * into v_k from public.bodekategori where id = p_bodekategori for update;
  if v_k.id is null then raise exception 'ikke_fundet'; end if;
  v_mig := private.mit_medlem(v_k.bodekasse_id);
  if v_k.oprettet_af <> v_mig
     and not exists (select 1 from public.medlem where id = v_mig and er_admin) then
    raise exception 'ikke_tilladt' using errcode = '42501';
  end if;
  return v_k;
end $$;

-- ---------- opret_bodekategori ----------
-- Any active Medlem, also in a Pause. Returns {"bodekategori_id": uuid}.
-- Errors: ikke_medlem (42501), kategorinavn_mangler, pris_ugyldig, navn_findes.
create function public.opret_bodekategori(
  p_klient_id uuid, p_bodekasse uuid, p_navn text, p_pris int, p_beskrivelse text default null)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_mig       uuid := private.mit_medlem(p_bodekasse);
  v_tidligere jsonb;
  v_navn      text;
  v_id        uuid;
begin
  v_tidligere := private.start_kald(p_klient_id, 'opret_bodekategori');
  if v_tidligere is not null then return v_tidligere; end if;

  v_navn := private.bodekategori_navn(p_navn);
  perform private.tjek_pris(p_pris);
  perform private.tjek_ledigt_navn(p_bodekasse, v_navn);

  begin
    insert into public.bodekategori (bodekasse_id, navn, pris, beskrivelse, oprettet_af)
    values (p_bodekasse, v_navn, p_pris, nullif(btrim(p_beskrivelse), ''), v_mig)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'navn_findes';   -- someone took the name a moment ago
  end;

  perform private.tilfoej_haendelse(
    p_bodekasse, v_mig, 'bodekategori_oprettet',
    jsonb_build_object('navn', v_navn, 'pris', p_pris),
    'bodekategori', v_id);
  return private.afslut_kald(p_klient_id, jsonb_build_object('bodekategori_id', v_id));
end $$;

revoke execute on function public.opret_bodekategori(uuid, uuid, text, int, text) from public, anon;
grant execute on function public.opret_bodekategori(uuid, uuid, text, int, text) to authenticated;

-- ---------- ret_bodekategori ----------
-- Creator or Admin; free. Changes only the Bødekategori: existing Bøder keep
-- the price they were given at. A new price adds a feed entry. Returns {}.
-- Errors: ikke_fundet, ikke_medlem / ikke_tilladt (42501), arkiveret,
-- kategorinavn_mangler, pris_ugyldig, navn_findes.
create function public.ret_bodekategori(
  p_klient_id uuid, p_bodekategori uuid, p_navn text, p_pris int, p_beskrivelse text)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_k         public.bodekategori;
  v_tidligere jsonb;
  v_navn      text;
begin
  v_k := private.min_bodekategori(p_bodekategori);
  v_tidligere := private.start_kald(p_klient_id, 'ret_bodekategori');
  if v_tidligere is not null then return v_tidligere; end if;

  if v_k.arkiveret is not null then raise exception 'arkiveret'; end if;
  v_navn := private.bodekategori_navn(p_navn);
  perform private.tjek_pris(p_pris);
  perform private.tjek_ledigt_navn(v_k.bodekasse_id, v_navn, v_k.id);

  update public.bodekategori
     set navn = v_navn, pris = p_pris, beskrivelse = nullif(btrim(p_beskrivelse), '')
   where id = v_k.id;

  if p_pris <> v_k.pris then
    perform private.tilfoej_haendelse(
      v_k.bodekasse_id, private.mit_medlem(v_k.bodekasse_id), 'bodekategori_ompriset',
      jsonb_build_object('navn', v_navn, 'gammel_pris', v_k.pris, 'ny_pris', p_pris),
      'bodekategori', v_k.id);
  end if;
  return private.afslut_kald(p_klient_id, '{}');
end $$;

revoke execute on function public.ret_bodekategori(uuid, uuid, text, int, text) from public, anon;
grant execute on function public.ret_bodekategori(uuid, uuid, text, int, text) to authenticated;

-- ---------- arkiver_bodekategori ----------
-- Creator or Admin. It leaves the list and Giv bøder; old Bøder keep it.
-- Archiving an archived one changes nothing. Returns {}.
create function public.arkiver_bodekategori(p_klient_id uuid, p_bodekategori uuid)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_k         public.bodekategori;
  v_tidligere jsonb;
begin
  v_k := private.min_bodekategori(p_bodekategori);
  v_tidligere := private.start_kald(p_klient_id, 'arkiver_bodekategori');
  if v_tidligere is not null then return v_tidligere; end if;

  if v_k.arkiveret is null then
    update public.bodekategori set arkiveret = now() where id = v_k.id;
    perform private.tilfoej_haendelse(
      v_k.bodekasse_id, private.mit_medlem(v_k.bodekasse_id), 'bodekategori_arkiveret',
      jsonb_build_object('navn', v_k.navn, 'pris', v_k.pris),
      'bodekategori', v_k.id);
  end if;
  return private.afslut_kald(p_klient_id, '{}');
end $$;

revoke execute on function public.arkiver_bodekategori(uuid, uuid) from public, anon;
grant execute on function public.arkiver_bodekategori(uuid, uuid) to authenticated;

-- ---------- gendan_bodekategori ----------
-- Creator or Admin brings an archived one back, if its name is free. No feed
-- entry. Returns {}. Errors: as above, plus navn_findes.
create function public.gendan_bodekategori(p_klient_id uuid, p_bodekategori uuid)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_k         public.bodekategori;
  v_tidligere jsonb;
begin
  v_k := private.min_bodekategori(p_bodekategori);
  v_tidligere := private.start_kald(p_klient_id, 'gendan_bodekategori');
  if v_tidligere is not null then return v_tidligere; end if;

  if v_k.arkiveret is not null then
    perform private.tjek_ledigt_navn(v_k.bodekasse_id, v_k.navn, v_k.id);
    begin
      update public.bodekategori set arkiveret = null where id = v_k.id;
    exception when unique_violation then
      raise exception 'navn_findes';
    end;
  end if;
  return private.afslut_kald(p_klient_id, '{}');
end $$;

revoke execute on function public.gendan_bodekategori(uuid, uuid) from public, anon;
grant execute on function public.gendan_bodekategori(uuid, uuid) to authenticated;
