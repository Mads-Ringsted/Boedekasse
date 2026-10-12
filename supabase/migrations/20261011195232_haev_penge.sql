-- #61: Hæv penge.
--
-- public.haev: an Admin takes money out of the box for a stated purpose.
-- Written with `create or replace` so the file can be re-applied by hand.

-- ---------- Hæv penge ----------

-- An Admin takes money out of the box. Never more than Kassen holds: the box
-- row is locked, so two Hævninger at once can't both pass the check. It
-- changes no Saldo. Works in a Pause: it gets the latest Sæson's id.
-- The purpose is required (trimmed).
-- Returns {"haevning_id": uuid}.
-- Errors: ikke_medlem / ikke_admin (42501), beloeb_ugyldig, formaal_mangler,
--   over_kassen.
-- Feed: art 'haevning', aktoer = the Admin, no modtager, ref haevning,
--   data {beloeb, formaal}.
create or replace function public.haev(
  p_klient_id uuid, p_bodekasse uuid, p_beloeb int, p_formaal text)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_mig       uuid := private.mit_admin(p_bodekasse);
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

revoke execute on function public.haev(uuid, uuid, int, text) from public, anon;
grant execute on function public.haev(uuid, uuid, int, text) to authenticated;

-- ---------- Annullér hævning ----------

-- An Admin annuls a Hævning made by mistake, with an optional note. The row
-- stays (annulleret_*) but leaves Kassen, so its money is back in the box.
-- It can't be reversed or annulled twice; only in the latest Sæson.
-- Returns {"haevning_id": uuid}.
-- Errors: ikke_medlem / ikke_admin (42501), ikke_fundet, allerede_annulleret,
--   tidligere_saeson.
-- Feed: art 'haevning_annulleret', aktoer = the Admin, no modtager, NO ref
--   (so the entry itself isn't shown struck through),
--   data {haevning_id, beloeb, formaal, note}.
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
  v_tidligere := private.start_kald(p_klient_id, 'annuller_haevning');
  if v_tidligere is not null then return v_tidligere; end if;

  select * into v_h from public.haevning where id = p_haevning for update;
  if v_h.id is null then raise exception 'ikke_fundet'; end if;
  v_mig := private.mit_admin(v_h.bodekasse_id);
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

revoke execute on function public.annuller_haevning(uuid, uuid, text) from public, anon;
grant execute on function public.annuller_haevning(uuid, uuid, text) to authenticated;
