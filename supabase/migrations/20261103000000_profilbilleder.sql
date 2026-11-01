-- Profilbilleder (spec #99, ticket #100): a Medlem's own picture in a box.
--
-- * Bucket `profilbilleder`, private, the app's first Storage bucket. Object
--   paths are <bodekasse_id>/<medlem_id>/<random file name>, so a new upload
--   never reuses a cached URL.
-- * Access rules on storage.objects for that bucket:
--     read:            active Medlemmer of the box (private.mine_bodekasser)
--     upload / delete: only into the folder of your own active Medlem
--   Other buckets are untouched (each policy checks bucket_id).
-- * medlem.billede_sti: the current picture's object path. Null = initials.
-- * RPCs saet_mit_billede and fjern_mit_billede, for your own active Medlem.
--   Both go through private.skift_billede, the one place that knows the
--   previous path (the cleanup outbox hooks in there).
--
-- Additive only: a bucket, policies, a nullable column, new functions.
-- Udmeldt keeps the picture; nothing here deletes files.

-- ---------- Bucket ----------
-- Keep equal to [storage.buckets.profilbilleder] in supabase/config.toml.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profilbilleder', 'profilbilleder', false, 1048576,
        array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

-- ---------- Column ----------
alter table public.medlem add column billede_sti text;

-- ---------- Access rules ----------

-- The folders the caller may write: '<bodekasse_id>/<medlem_id>' of each of
-- their active (not Udmeldt) Medlemmer.
create function private.mine_billedmapper() returns setof text
language sql stable security definer set search_path = '' as $$
  select bodekasse_id::text || '/' || id::text from public.medlem
   where user_id = (select auth.uid()) and udmeldt is null
$$;

-- The folder part of an object path, when it has exactly the
-- <bodekasse>/<medlem>/<file> shape; null otherwise.
create function private.billedmappe(p_sti text) returns text
language sql immutable set search_path = '' as $$
  select case when array_length(string_to_array(p_sti, '/'), 1) = 3
              then split_part(p_sti, '/', 1) || '/' || split_part(p_sti, '/', 2) end
$$;

revoke execute on function private.mine_billedmapper(), private.billedmappe(text) from public, anon;
grant execute on function private.mine_billedmapper(), private.billedmappe(text) to authenticated;

create policy profilbilleder_laes on storage.objects for select to authenticated
  using (bucket_id = 'profilbilleder'
         and split_part(name, '/', 1) in (select b::text from private.mine_bodekasser() b));

create policy profilbilleder_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'profilbilleder'
              and private.billedmappe(name) in (select private.mine_billedmapper()));

create policy profilbilleder_slet on storage.objects for delete to authenticated
  using (bucket_id = 'profilbilleder'
         and private.billedmappe(name) in (select private.mine_billedmapper()));

-- ---------- Setting and removing ----------

-- Points a Medlem at a new picture path (null = none) and returns the
-- previous path. The one place a picture changes: the cleanup outbox (#104)
-- queues the returned old path here.
create function private.skift_billede(p_medlem uuid, p_sti text) returns text
language plpgsql volatile security definer set search_path = '' as $$
declare v_gammel text;
begin
  select billede_sti into v_gammel from public.medlem where id = p_medlem for update;
  update public.medlem set billede_sti = p_sti where id = p_medlem;
  return v_gammel;
end $$;

-- The checks every new picture path gets once its folder is known to be
-- right: the file name is <letters, digits, _ or ->.<webp|jpg|jpeg|png>,
-- and the file is uploaded. Used by saet_mit_billede and kopier_mit_billede.
-- Errors: billede_sti_ugyldig, billede_findes_ikke.
create function private.tjek_billede_sti(p_sti text) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_sti is null or split_part(p_sti, '/', 3) !~ '^[A-Za-z0-9_-]+\.(webp|jpe?g|png)$' then
    raise exception 'billede_sti_ugyldig';
  end if;
  if not exists (select 1 from storage.objects where bucket_id = 'profilbilleder' and name = p_sti) then
    raise exception 'billede_findes_ikke';
  end if;
end $$;

revoke execute on function private.tjek_billede_sti(text) from public, anon, authenticated;

-- Sets your picture in one box, after the client uploaded the file. The path
-- must be a file directly in your own Medlem's folder in that box, and the
-- file must exist. No feed entry. Returns {"billede_sti": text}.
-- Errors: ikke_medlem (42501), billede_sti_ugyldig, billede_findes_ikke.
create function public.saet_mit_billede(p_klient_id uuid, p_bodekasse uuid, p_sti text)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_mig       uuid := private.mit_medlem(p_bodekasse);
  v_tidligere jsonb;
begin
  v_tidligere := private.start_kald(p_klient_id, 'saet_mit_billede');
  if v_tidligere is not null then return v_tidligere; end if;
  if private.billedmappe(p_sti) is distinct from p_bodekasse::text || '/' || v_mig::text then
    raise exception 'billede_sti_ugyldig';
  end if;
  perform private.tjek_billede_sti(p_sti);
  perform private.skift_billede(v_mig, p_sti);
  return private.afslut_kald(p_klient_id, jsonb_build_object('billede_sti', p_sti));
end $$;

-- Removes your picture in one box: initials show again. No feed entry.
-- Returns {"billede_sti": null}. Errors: ikke_medlem (42501).
create function public.fjern_mit_billede(p_klient_id uuid, p_bodekasse uuid)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_mig       uuid := private.mit_medlem(p_bodekasse);
  v_tidligere jsonb;
begin
  v_tidligere := private.start_kald(p_klient_id, 'fjern_mit_billede');
  if v_tidligere is not null then return v_tidligere; end if;
  perform private.skift_billede(v_mig, null);
  return private.afslut_kald(p_klient_id, jsonb_build_object('billede_sti', null));
end $$;

revoke execute on function public.saet_mit_billede(uuid, uuid, text) from public, anon;
grant execute on function public.saet_mit_billede(uuid, uuid, text) to authenticated;
revoke execute on function public.fjern_mit_billede(uuid, uuid) from public, anon;
grant execute on function public.fjern_mit_billede(uuid, uuid) to authenticated;
