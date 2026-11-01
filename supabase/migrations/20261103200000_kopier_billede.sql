-- Brug også i mine andre bødekasser (spec #99, ticket #103): set the picture
-- you just saved in one box on your Medlemmer in your other active boxes.
--
-- Postgres can't copy file bytes, so the copy has two halves:
--   1. The client copies the object in Storage, once per other box, into
--      that Medlem's own folder: <other box>/<your Medlem there>/<random>.
--      The #100 access rules already allow it: you can read your own picture
--      and write only into your own active Medlem's folders.
--   2. kopier_mit_billede (here) points those Medlemmer at their copies, in
--      one call: all or nothing. Each Medlem keeps its own file, so each
--      box's read rule still holds, and later cleanup of one box never
--      removes another box's picture.
-- Each change goes through private.skift_billede, so the replaced pictures
-- are queued for cleanup (#104).
--
-- Additive only: one new function. Redefines nothing.

-- Sets copies of your picture in box p_bodekasse on your Medlemmer in other
-- boxes. p_stier: one path per target, each a file directly in the folder of
-- your own active Medlem in a box other than p_bodekasse, and uploaded.
-- You must have a picture in p_bodekasse. No feed entry.
-- Returns {"billede_stier": [text]}.
-- Errors: ikke_medlem (42501), intet_billede, billede_sti_ugyldig,
-- billede_findes_ikke.
create function public.kopier_mit_billede(p_klient_id uuid, p_bodekasse uuid, p_stier text[])
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_mig       uuid := private.mit_medlem(p_bodekasse);
  v_tidligere jsonb;
  v_sti       text;
  v_maal      uuid;
  v_sat       uuid[] := '{}';
begin
  v_tidligere := private.start_kald(p_klient_id, 'kopier_mit_billede');
  if v_tidligere is not null then return v_tidligere; end if;
  if (select billede_sti from public.medlem where id = v_mig) is null then
    raise exception 'intet_billede';
  end if;
  foreach v_sti in array coalesce(p_stier, '{}') loop
    -- The target: your own active Medlem whose folder holds the path.
    select m.id into v_maal from public.medlem m
     where v_sti is not null
       and private.billedmappe(v_sti) = m.bodekasse_id::text || '/' || m.id::text
       and m.user_id = (select auth.uid()) and m.udmeldt is null
       and m.bodekasse_id <> p_bodekasse;
    if v_maal is null or v_maal = any (v_sat) then
      raise exception 'billede_sti_ugyldig';
    end if;
    perform private.tjek_billede_sti(v_sti);
    perform private.skift_billede(v_maal, v_sti);
    v_sat := v_sat || v_maal;
  end loop;
  return private.afslut_kald(p_klient_id,
    jsonb_build_object('billede_stier', to_jsonb(coalesce(p_stier, '{}'))));
end $$;

revoke execute on function public.kopier_mit_billede(uuid, uuid, text[]) from public, anon;
grant execute on function public.kopier_mit_billede(uuid, uuid, text[]) to authenticated;
