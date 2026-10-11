-- #50: Opret Bødekasse. A signed-in person creates a box with a box name and
-- their own name. In one transaction: the box (default settings), its join
-- code, the caller as its first Admin Medlem, the first Sæson
-- ("Sæson <year>", running) and one feed entry.
--
-- Returns {"bodekasse_id": uuid, "medlem_id": uuid}.
-- Errors: ikke_logget_ind (42501), navn_mangler, mit_navn_mangler.
create function public.opret_bodekasse(p_klient_id uuid, p_navn text, p_mit_navn text)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_bruger    uuid := (select auth.uid());
  v_navn      text := btrim(p_navn);
  v_mit_navn  text := btrim(p_mit_navn);
  v_tidligere jsonb;
  v_kasse     uuid;
  v_mig       uuid;
  v_saeson    uuid;
  v_saeson_navn text;
begin
  -- 1. who is calling: any login (there is no box yet to be a Medlem of)
  if v_bruger is null then
    raise exception 'ikke_logget_ind' using errcode = '42501';
  end if;
  -- 4. a repeat with the same one-time ID returns the first answer
  v_tidligere := private.start_kald(p_klient_id, 'opret_bodekasse');
  if v_tidligere is not null then return v_tidligere; end if;
  -- 2. rules
  if coalesce(v_navn, '') = '' then raise exception 'navn_mangler'; end if;
  if coalesce(v_mit_navn, '') = '' then raise exception 'mit_navn_mangler'; end if;
  -- 3. write
  insert into public.bodekasse (navn) values (v_navn) returning id into v_kasse;
  insert into public.bodekasse_kode (bodekasse_id, kode) values (v_kasse, private.ny_join_kode());
  -- The login's email goes on the Medlem, like a claimed spot (already linked).
  insert into public.medlem (bodekasse_id, navn, email, user_id, er_admin)
  select v_kasse, v_mit_navn, lower(u.email), v_bruger, true
    from auth.users u where u.id = v_bruger
  returning id into v_mig;
  v_saeson_navn := 'Sæson ' || extract(year from now() at time zone 'Europe/Copenhagen')::int;
  insert into public.saeson (bodekasse_id, navn) values (v_kasse, v_saeson_navn)
  returning id into v_saeson;
  perform private.tilfoej_haendelse(
    v_kasse, v_mig, 'bodekasse_oprettet',
    jsonb_build_object('bodekasse_navn', v_navn, 'saeson_navn', v_saeson_navn),
    'bodekasse', v_kasse, p_saeson => v_saeson);
  return private.afslut_kald(p_klient_id,
    jsonb_build_object('bodekasse_id', v_kasse, 'medlem_id', v_mig));
end $$;

revoke execute on function public.opret_bodekasse(uuid, text, text) from public, anon;
grant execute on function public.opret_bodekasse(uuid, text, text) to authenticated;
