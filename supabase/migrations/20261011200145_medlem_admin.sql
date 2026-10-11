-- #69: Admin actions on a Medlem. Roles (with the last-Admin guard), Ret navn,
-- Ret email (before they log in), Meld ud, Genoptag and Slet.

-- ---------- Shared helpers ----------

-- A Medlem of this box (Udmeldt included), locked for the change.
-- Errors: medlem_ukendt.
create function private.medlem_i_kassen(p_bodekasse uuid, p_medlem uuid) returns public.medlem
language plpgsql volatile security definer set search_path = '' as $$
declare v_medlem public.medlem;
begin
  select * into v_medlem from public.medlem
   where id = p_medlem and bodekasse_id = p_bodekasse
   for update;
  if v_medlem.id is null then raise exception 'medlem_ukendt'; end if;
  return v_medlem;
end $$;

-- The last-Admin guard: raises 'sidste_admin' when this Medlem is an active
-- Admin and no other active Admin is left in the box. Call it before anything
-- that takes away a Medlem's Admin role or access (Fjern som Admin, Meld ud,
-- Slet konto). It locks the box's Admin rows, so two Admins dropping their
-- roles at once can't both pass.
create function private.tjek_ikke_sidste_admin(p_bodekasse uuid, p_medlem uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform 1 from public.medlem
   where bodekasse_id = p_bodekasse and er_admin and udmeldt is null
   for update;
  if exists (select 1 from public.medlem
              where id = p_medlem and bodekasse_id = p_bodekasse and er_admin and udmeldt is null)
     and not exists (select 1 from public.medlem
                      where bodekasse_id = p_bodekasse and er_admin and udmeldt is null
                        and id <> p_medlem) then
    raise exception 'sidste_admin';
  end if;
end $$;

-- ---------- Gør til Admin / Fjern som Admin ----------
-- Any Admin changes any active Medlem's role, their own included. The last
-- Admin can't drop it. No feed entry. Returns {"er_admin": bool}.
-- Errors: ikke_medlem / ikke_admin (42501), medlem_ukendt, medlem_udmeldt,
-- sidste_admin.
create function public.saet_admin(p_klient_id uuid, p_bodekasse uuid, p_medlem uuid, p_er_admin boolean)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_mig       uuid := private.mit_admin(p_bodekasse);
  v_tidligere jsonb;
  v_medlem    public.medlem;
begin
  v_tidligere := private.start_kald(p_klient_id, 'saet_admin');
  if v_tidligere is not null then return v_tidligere; end if;
  v_medlem := private.medlem_i_kassen(p_bodekasse, p_medlem);
  if v_medlem.udmeldt is not null then raise exception 'medlem_udmeldt'; end if;
  if not coalesce(p_er_admin, false) then
    perform private.tjek_ikke_sidste_admin(p_bodekasse, p_medlem);
  end if;
  update public.medlem set er_admin = coalesce(p_er_admin, false) where id = p_medlem;
  return private.afslut_kald(p_klient_id, jsonb_build_object('er_admin', coalesce(p_er_admin, false)));
end $$;

revoke execute on function public.saet_admin(uuid, uuid, uuid, boolean) from public, anon;
grant execute on function public.saet_admin(uuid, uuid, uuid, boolean) to authenticated;

-- ---------- Meld ud / Genoptag ----------
-- An Admin makes another Medlem Udmeldt, also while they still owe. The
-- Udmeldt keeps history and Saldo, leaves Giv bøder, the Topliste and absent
-- Gebyrer, and loses read access (mine_bodekasser skips Udmeldte), so the box
-- disappears from their app. Nobody melder themself ud. An Udmeldt Admin
-- loses the role (Genoptag brings them back as a plain Medlem).
-- Returns {}. Feed: art 'medlem_udmeldt', aktoer = the Admin, modtager = the
-- Medlem, ref medlem, data {navn}.
-- Errors: ikke_medlem / ikke_admin (42501), medlem_ukendt, medlem_udmeldt,
-- melder_dig_selv_ud, sidste_admin.
create function public.udmeld(p_klient_id uuid, p_bodekasse uuid, p_medlem uuid)
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

  update public.medlem set udmeldt = now(), er_admin = false where id = p_medlem;
  perform private.tilfoej_haendelse(
    p_bodekasse, v_mig, 'medlem_udmeldt', jsonb_build_object('navn', v_medlem.navn),
    'medlem', p_medlem, p_modtager => p_medlem);
  return private.afslut_kald(p_klient_id, '{}'::jsonb);
end $$;

revoke execute on function public.udmeld(uuid, uuid, uuid) from public, anon;
grant execute on function public.udmeld(uuid, uuid, uuid) to authenticated;

-- An Admin brings an Udmeldt back to the same spot, with full history.
-- Returns {}. Feed: art 'medlem_genoptaget', aktoer = the Admin, modtager =
-- the Medlem, ref medlem, data {navn}.
-- Errors: ikke_medlem / ikke_admin (42501), medlem_ukendt, medlem_ikke_udmeldt.
create function public.genoptag(p_klient_id uuid, p_bodekasse uuid, p_medlem uuid)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_mig       uuid := private.mit_admin(p_bodekasse);
  v_tidligere jsonb;
  v_medlem    public.medlem;
begin
  v_tidligere := private.start_kald(p_klient_id, 'genoptag');
  if v_tidligere is not null then return v_tidligere; end if;
  v_medlem := private.medlem_i_kassen(p_bodekasse, p_medlem);
  if v_medlem.udmeldt is null then raise exception 'medlem_ikke_udmeldt'; end if;

  update public.medlem set udmeldt = null where id = p_medlem;
  perform private.tilfoej_haendelse(
    p_bodekasse, v_mig, 'medlem_genoptaget', jsonb_build_object('navn', v_medlem.navn),
    'medlem', p_medlem, p_modtager => p_medlem);
  return private.afslut_kald(p_klient_id, '{}'::jsonb);
end $$;

revoke execute on function public.genoptag(uuid, uuid, uuid) from public, anon;
grant execute on function public.genoptag(uuid, uuid, uuid) to authenticated;

-- ---------- Ret navn / Ret email ----------
-- An Admin fixes a Medlem's name in this box (Udmeldte too). No feed entry.
-- Returns {"navn": text}.
-- Errors: ikke_medlem / ikke_admin (42501), medlem_ukendt, medlem_navn_mangler.
create function public.ret_medlem_navn(p_klient_id uuid, p_bodekasse uuid, p_medlem uuid, p_navn text)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_mig       uuid := private.mit_admin(p_bodekasse);
  v_navn      text := btrim(p_navn);
  v_tidligere jsonb;
begin
  v_tidligere := private.start_kald(p_klient_id, 'ret_medlem_navn');
  if v_tidligere is not null then return v_tidligere; end if;
  perform private.medlem_i_kassen(p_bodekasse, p_medlem);
  if coalesce(v_navn, '') = '' then raise exception 'medlem_navn_mangler'; end if;
  update public.medlem set navn = v_navn where id = p_medlem;
  return private.afslut_kald(p_klient_id, jsonb_build_object('navn', v_navn));
end $$;

revoke execute on function public.ret_medlem_navn(uuid, uuid, uuid, text) from public, anon;
grant execute on function public.ret_medlem_navn(uuid, uuid, uuid, text) to authenticated;

-- An Admin fixes the email of a Medlem who has not logged in yet. If a
-- confirmed login with the new email exists, it claims the spot at once
-- (claim trigger in the schema). No feed entry. Returns {"email": text}.
-- Errors: ikke_medlem / ikke_admin (42501), medlem_ukendt, medlem_logget_ind,
-- email_mangler, email_ugyldig, email_findes.
create function public.ret_medlem_email(p_klient_id uuid, p_bodekasse uuid, p_medlem uuid, p_email text)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_mig       uuid := private.mit_admin(p_bodekasse);
  v_email     text := lower(btrim(p_email));
  v_tidligere jsonb;
  v_medlem    public.medlem;
begin
  v_tidligere := private.start_kald(p_klient_id, 'ret_medlem_email');
  if v_tidligere is not null then return v_tidligere; end if;
  v_medlem := private.medlem_i_kassen(p_bodekasse, p_medlem);
  if v_medlem.user_id is not null then raise exception 'medlem_logget_ind'; end if;
  if coalesce(v_email, '') = '' then raise exception 'email_mangler'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'email_ugyldig'; end if;
  -- Same rule as Tilføj Medlem: not another Medlem's email or login.
  if exists (select 1 from public.medlem m
               left join auth.users u on u.id = m.user_id
              where m.bodekasse_id = p_bodekasse and m.id <> p_medlem
                and (m.email = v_email or lower(u.email) = v_email)) then
    raise exception 'email_findes';
  end if;
  update public.medlem set email = v_email where id = p_medlem;
  return private.afslut_kald(p_klient_id, jsonb_build_object('email', v_email));
end $$;

revoke execute on function public.ret_medlem_email(uuid, uuid, uuid, text) from public, anon;
grant execute on function public.ret_medlem_email(uuid, uuid, uuid, text) to authenticated;

-- ---------- Slet ----------
-- Why a Medlem can't be deleted; grund null = they can. One row per Medlem.
--   logget_ind     claimed by a login, or has done something themself
--   boeder         gave or received a Bøde
--   gebyrer        was charged a Gebyr
--   indbetalinger  has an Indbetaling or a Betalingsmelding
--   historik       anything else (a Bødekategori, Frikøb, Konkurrence, feed
--                  entries other than being added, e.g. Udmeldt)
create view public.medlem_slet_grund with (security_invoker = true) as
select m.bodekasse_id, m.id as medlem_id,
       case
         when m.user_id is not null
           or exists (select 1 from public.haendelse h where h.aktoer_id = m.id)
           then 'logget_ind'
         when exists (select 1 from public.bode b where b.modtager_id = m.id or b.giver_id = m.id)
           then 'boeder'
         when exists (select 1 from public.gebyr g where g.medlem_id = m.id)
           then 'gebyrer'
         when exists (select 1 from public.indbetaling i where i.medlem_id = m.id)
           or exists (select 1 from public.betalingsmelding bm where bm.medlem_id = m.id)
           then 'indbetalinger'
         when exists (select 1 from public.bodekategori k where k.oprettet_af = m.id)
           or exists (select 1 from public.frikob f where f.medlem_id = m.id)
           or exists (select 1 from public.konkurrence_resultat r where r.medlem_id = m.id)
           or exists (select 1 from public.haendelse h
                       where h.modtager_id = m.id and h.art <> 'medlem_tilfoejet')
           then 'historik'
       end as grund
  from public.medlem m;

grant select on public.medlem_slet_grund to authenticated;

-- An Admin deletes a Medlem who never logged in and has no history (see
-- medlem_slet_grund). Their "added" feed entry goes too. Returns {}.
-- Errors: ikke_medlem / ikke_admin (42501), medlem_ukendt, medlem_logget_ind,
-- medlem_har_boeder, medlem_har_gebyrer, medlem_har_indbetalinger,
-- medlem_har_historik.
create function public.slet_medlem(p_klient_id uuid, p_bodekasse uuid, p_medlem uuid)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_mig       uuid := private.mit_admin(p_bodekasse);
  v_tidligere jsonb;
  v_grund     text;
begin
  v_tidligere := private.start_kald(p_klient_id, 'slet_medlem');
  if v_tidligere is not null then return v_tidligere; end if;
  perform private.medlem_i_kassen(p_bodekasse, p_medlem);
  select grund into v_grund from public.medlem_slet_grund where medlem_id = p_medlem;
  if v_grund = 'logget_ind' then raise exception 'medlem_logget_ind'; end if;
  if v_grund is not null then raise exception 'medlem_har_%', v_grund; end if;

  delete from public.haendelse
   where bodekasse_id = p_bodekasse and art = 'medlem_tilfoejet' and modtager_id = p_medlem;
  begin
    delete from public.medlem where id = p_medlem;
  exception when foreign_key_violation then
    -- a row the view doesn't know about yet still points at the Medlem
    raise exception 'medlem_har_historik';
  end;
  return private.afslut_kald(p_klient_id, '{}'::jsonb);
end $$;

revoke execute on function public.slet_medlem(uuid, uuid, uuid) from public, anon;
grant execute on function public.slet_medlem(uuid, uuid, uuid) to authenticated;
