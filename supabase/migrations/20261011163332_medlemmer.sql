-- #51: Medlemmer. An Admin adds a Medlem by name and email, an Admin shares
-- or renews the join code, a person with the code joins, and a Medlem renames
-- themself. Names are per box (they live on the Medlem row).

-- ---------- Tilføj Medlem ----------
-- An Admin adds a Medlem by name and email. The Medlem can get Bøder at once
-- and is claimed when that email logs in (claim triggers in the schema).
--
-- Returns {"medlem_id": uuid}.
-- Feed: art 'medlem_tilfoejet', aktoer = the Admin, modtager = the new Medlem,
-- ref medlem, data {navn}.
-- Errors: ikke_medlem / ikke_admin (42501), medlem_navn_mangler,
-- email_mangler, email_ugyldig, email_findes.
create function public.tilfoej_medlem(p_klient_id uuid, p_bodekasse uuid, p_navn text, p_email text)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_mig       uuid := private.mit_admin(p_bodekasse);
  v_navn      text := btrim(p_navn);
  v_email     text := lower(btrim(p_email));
  v_tidligere jsonb;
  v_ny        uuid;
begin
  v_tidligere := private.start_kald(p_klient_id, 'tilfoej_medlem');
  if v_tidligere is not null then return v_tidligere; end if;

  if coalesce(v_navn, '') = '' then raise exception 'medlem_navn_mangler'; end if;
  if coalesce(v_email, '') = '' then raise exception 'email_mangler'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'email_ugyldig'; end if;
  -- Already in the box: as a stored email, or as the login of a Medlem
  -- (Udmeldte included; an Admin genoptager them instead).
  if exists (select 1 from public.medlem m
               left join auth.users u on u.id = m.user_id
              where m.bodekasse_id = p_bodekasse
                and (m.email = v_email or lower(u.email) = v_email)) then
    raise exception 'email_findes';
  end if;

  insert into public.medlem (bodekasse_id, navn, email)
  values (p_bodekasse, v_navn, v_email)
  returning id into v_ny;

  perform private.tilfoej_haendelse(
    p_bodekasse, v_mig, 'medlem_tilfoejet', jsonb_build_object('navn', v_navn),
    'medlem', v_ny, p_modtager => v_ny);

  return private.afslut_kald(p_klient_id, jsonb_build_object('medlem_id', v_ny));
end $$;

revoke execute on function public.tilfoej_medlem(uuid, uuid, text, text) from public, anon;
grant execute on function public.tilfoej_medlem(uuid, uuid, text, text) to authenticated;

-- ---------- Join code ----------
-- An Admin reads the code from public.bodekasse_kode (Admin-only RLS).

-- An Admin makes a new join code. The old code stops working at once.
-- Returns {"kode": text}. Errors: ikke_medlem / ikke_admin (42501).
create function public.forny_join_kode(p_klient_id uuid, p_bodekasse uuid)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_mig       uuid := private.mit_admin(p_bodekasse);
  v_tidligere jsonb;
  v_kode      text;
begin
  v_tidligere := private.start_kald(p_klient_id, 'forny_join_kode');
  if v_tidligere is not null then return v_tidligere; end if;
  v_kode := private.ny_join_kode();
  insert into public.bodekasse_kode (bodekasse_id, kode) values (p_bodekasse, v_kode)
  on conflict (bodekasse_id) do update set kode = excluded.kode;
  return private.afslut_kald(p_klient_id, jsonb_build_object('kode', v_kode));
end $$;

revoke execute on function public.forny_join_kode(uuid, uuid) from public, anon;
grant execute on function public.forny_join_kode(uuid, uuid) to authenticated;

-- The box a typed code belongs to (spaces and case ignored), or null.
create function private.kasse_med_kode(p_kode text) returns uuid
language sql stable security definer set search_path = '' as $$
  select bodekasse_id from public.bodekasse_kode
   where kode = upper(regexp_replace(coalesce(p_kode, ''), '\s', '', 'g'))
$$;

-- The caller's spot in a box, Udmeldt included: their claimed Medlem, or an
-- unclaimed one with their login email. Null if none.
create function private.min_plads(p_bodekasse uuid) returns public.medlem
language sql stable security definer set search_path = '' as $$
  select m.* from public.medlem m
   where m.bodekasse_id = p_bodekasse
     and (m.user_id = (select auth.uid())
          or (m.user_id is null
              and m.email = (select lower(u.email) from auth.users u where u.id = (select auth.uid()))))
   order by m.user_id nulls last
   limit 1
$$;

-- Jeg har en kode, step 1: the box behind a code, shown before joining.
-- Any login. Returns {bodekasse_id, navn, antal_medlemmer, allerede_medlem}.
-- Errors: ikke_logget_ind (42501), kode_ukendt, udmeldt.
create function public.find_bodekasse_med_kode(p_kode text)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_kasse uuid;
  v_plads public.medlem;
begin
  if (select auth.uid()) is null then
    raise exception 'ikke_logget_ind' using errcode = '42501';
  end if;
  v_kasse := private.kasse_med_kode(p_kode);
  if v_kasse is null then raise exception 'kode_ukendt'; end if;
  v_plads := private.min_plads(v_kasse);
  if v_plads.udmeldt is not null then raise exception 'udmeldt'; end if;
  return (
    select jsonb_build_object(
             'bodekasse_id', b.id,
             'navn', b.navn,
             'antal_medlemmer', (select count(*) from public.medlem m
                                  where m.bodekasse_id = b.id and m.udmeldt is null),
             'allerede_medlem', v_plads.id is not null)
      from public.bodekasse b where b.id = v_kasse);
end $$;

revoke execute on function public.find_bodekasse_med_kode(text) from public, anon;
grant execute on function public.find_bodekasse_med_kode(text) to authenticated;

-- Jeg har en kode, step 2: join the box with your name. Any login.
-- Already a Medlem: returns that spot unchanged (an unclaimed spot with your
-- email is claimed). Udmeldt: rejected.
-- Returns {"bodekasse_id": uuid, "medlem_id": uuid}.
-- Feed: art 'medlem_tilmeldt', aktoer = the new Medlem, ref medlem, data {navn}.
-- Errors: ikke_logget_ind (42501), kode_ukendt, udmeldt, mit_navn_mangler.
create function public.tilmeld_med_kode(p_klient_id uuid, p_kode text, p_mit_navn text)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_bruger    uuid := (select auth.uid());
  v_navn      text := btrim(p_mit_navn);
  v_tidligere jsonb;
  v_kasse     uuid;
  v_plads     public.medlem;
  v_ny        uuid;
begin
  if v_bruger is null then
    raise exception 'ikke_logget_ind' using errcode = '42501';
  end if;
  v_tidligere := private.start_kald(p_klient_id, 'tilmeld_med_kode');
  if v_tidligere is not null then return v_tidligere; end if;

  v_kasse := private.kasse_med_kode(p_kode);
  if v_kasse is null then raise exception 'kode_ukendt'; end if;

  v_plads := private.min_plads(v_kasse);
  if v_plads.udmeldt is not null then raise exception 'udmeldt'; end if;
  if v_plads.id is not null then
    if v_plads.user_id is null then
      update public.medlem set user_id = v_bruger where id = v_plads.id;
    end if;
    return private.afslut_kald(p_klient_id,
      jsonb_build_object('bodekasse_id', v_kasse, 'medlem_id', v_plads.id));
  end if;

  if coalesce(v_navn, '') = '' then raise exception 'mit_navn_mangler'; end if;

  insert into public.medlem (bodekasse_id, navn, email, user_id)
  select v_kasse, v_navn, lower(u.email), v_bruger from auth.users u where u.id = v_bruger
  returning id into v_ny;

  perform private.tilfoej_haendelse(
    v_kasse, v_ny, 'medlem_tilmeldt', jsonb_build_object('navn', v_navn), 'medlem', v_ny);

  return private.afslut_kald(p_klient_id,
    jsonb_build_object('bodekasse_id', v_kasse, 'medlem_id', v_ny));
end $$;

revoke execute on function public.tilmeld_med_kode(uuid, text, text) from public, anon;
grant execute on function public.tilmeld_med_kode(uuid, text, text) to authenticated;

-- ---------- Your own name ----------
-- A Medlem changes their own name in one box. No feed entry (name edits
-- don't show in Aktivitet). Returns {"navn": text}.
-- Errors: ikke_medlem (42501), mit_navn_mangler.
create function public.ret_mit_navn(p_klient_id uuid, p_bodekasse uuid, p_navn text)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_mig       uuid := private.mit_medlem(p_bodekasse);
  v_navn      text := btrim(p_navn);
  v_tidligere jsonb;
begin
  v_tidligere := private.start_kald(p_klient_id, 'ret_mit_navn');
  if v_tidligere is not null then return v_tidligere; end if;
  if coalesce(v_navn, '') = '' then raise exception 'mit_navn_mangler'; end if;
  update public.medlem set navn = v_navn where id = v_mig;
  return private.afslut_kald(p_klient_id, jsonb_build_object('navn', v_navn));
end $$;

revoke execute on function public.ret_mit_navn(uuid, uuid, text) from public, anon;
grant execute on function public.ret_mit_navn(uuid, uuid, text) to authenticated;
