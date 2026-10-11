-- #71: Slet Bødekasse (an Admin deletes the whole box) and Slet konto (a
-- person deletes their login; their Medlemmer stay as unclaimed spots).

-- ---------- Slet Bødekasse ----------
-- An Admin deletes the box and everything in it, for everyone, after typing
-- its exact name (spaces around it are ignored; case counts). Logins stay.
-- No feed entry (the feed goes too). Returns {}.
-- The one-time ID is claimed before the Admin check, so a repeat after the
-- box is gone still gets the first answer.
-- Errors: ikke_medlem / ikke_admin (42501), navn_passer_ikke.
create function public.slet_bodekasse(p_klient_id uuid, p_bodekasse uuid, p_navn text)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_tidligere jsonb;
  v_navn      text;
begin
  v_tidligere := private.start_kald(p_klient_id, 'slet_bodekasse');
  if v_tidligere is not null then return v_tidligere; end if;
  perform private.mit_admin(p_bodekasse);
  select navn into v_navn from public.bodekasse where id = p_bodekasse for update;
  if btrim(coalesce(p_navn, '')) is distinct from v_navn then
    raise exception 'navn_passer_ikke';
  end if;
  delete from public.bodekasse where id = p_bodekasse;
  return private.afslut_kald(p_klient_id, '{}'::jsonb);
end $$;

revoke execute on function public.slet_bodekasse(uuid, uuid, text) from public, anon;
grant execute on function public.slet_bodekasse(uuid, uuid, text) to authenticated;

-- ---------- Slet konto ----------
-- When a login disappears (Slet konto, or deleted any other way: the foreign
-- key sets user_id to null), its Medlemmer stay with name, role and history,
-- but lose the email, so a new login with that email doesn't take them back.
-- konto_slettet marks the spot as once claimed: medlem_slet_grund and
-- slet_medlem never treat it as "never logged in".
alter table public.medlem add column konto_slettet timestamptz;

create function private.marker_konto_slettet() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.konto_slettet := now();
  new.email := null;
  return new;
end $$;

create trigger medlem_konto_slettet
  before update of user_id on public.medlem
  for each row when (old.user_id is not null and new.user_id is null)
  execute function private.marker_konto_slettet();

-- Same view as #69, plus: a spot whose login was deleted counts as logged in.
create or replace view public.medlem_slet_grund with (security_invoker = true) as
select m.bodekasse_id, m.id as medlem_id,
       case
         when m.user_id is not null
           or m.konto_slettet is not null
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

-- The boxes where the caller is the last active Admin. Slet konto is blocked
-- until each of them has another Admin (or is deleted).
create view public.sidste_admin_kasse with (security_invoker = true) as
select b.id as bodekasse_id, b.navn
  from public.medlem m
  join public.bodekasse b on b.id = m.bodekasse_id
 where m.user_id = (select auth.uid()) and m.er_admin and m.udmeldt is null
   and not exists (select 1 from public.medlem o
                    where o.bodekasse_id = m.bodekasse_id and o.id <> m.id
                      and o.er_admin and o.udmeldt is null);

grant select on public.sidste_admin_kasse to authenticated;

-- The caller deletes their own login. Every Medlem of theirs (Udmeldte too)
-- becomes an unclaimed spot (see medlem_konto_slettet above). The app then
-- logs out on the device. Returns {}.
-- Errors: sidste_admin (the last Admin of a box must hand over first).
create function public.slet_konto(p_klient_id uuid)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_bruger    uuid := (select auth.uid());
  v_tidligere jsonb;
  v_medlem    public.medlem;
begin
  if v_bruger is null then raise exception 'ikke_logget_ind' using errcode = '42501'; end if;
  v_tidligere := private.start_kald(p_klient_id, 'slet_konto');
  if v_tidligere is not null then return v_tidligere; end if;
  for v_medlem in
    select * from public.medlem where user_id = v_bruger and er_admin and udmeldt is null
     order by bodekasse_id
  loop
    perform private.tjek_ikke_sidste_admin(v_medlem.bodekasse_id, v_medlem.id);
  end loop;
  update public.medlem set user_id = null where user_id = v_bruger;
  delete from auth.users where id = v_bruger;
  return private.afslut_kald(p_klient_id, '{}'::jsonb);
end $$;

revoke execute on function public.slet_konto(uuid) from public, anon;
grant execute on function public.slet_konto(uuid) to authenticated;
