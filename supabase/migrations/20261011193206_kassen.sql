-- #59: Kassen and Registrér indbetaling.
--
-- public.registrer_indbetaling: an Admin records money a Medlem paid.
-- Written with `create or replace` so the file can be re-applied by hand.

-- ---------- Registrér indbetaling ----------

-- An Admin records an Indbetaling from any Medlem of the box: themself and
-- Udmeldte included. It counts against the whole Saldo, so paying too much
-- leaves Til gode. Works in a Pause: it gets the latest Sæson's id.
-- The note is optional (trimmed; empty = none).
-- Returns {"indbetaling_id": uuid}.
-- Errors: ikke_medlem / ikke_admin (42501), medlem_ukendt, beloeb_ugyldig.
-- Feed: art 'indbetaling', aktoer = the Admin, modtager = who paid,
--   ref indbetaling, data {navn, beloeb, note}.
create or replace function public.registrer_indbetaling(
  p_klient_id uuid, p_bodekasse uuid, p_medlem uuid, p_beloeb int, p_note text default null)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_mig       uuid := private.mit_admin(p_bodekasse);
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

revoke execute on function public.registrer_indbetaling(uuid, uuid, uuid, int, text) from public, anon;
grant execute on function public.registrer_indbetaling(uuid, uuid, uuid, int, text) to authenticated;

-- ---------- Annulling ----------

-- Annulments work on the latest Sæson until the next one starts, Pause
-- included; past Sæsoner are read-only. Raises tidligere_saeson otherwise.
-- Reusable by every annul RPC (#61 Hævning, #62 Bøder and Gebyrer, ...).
create or replace function private.tjek_seneste_saeson(p_bodekasse uuid, p_saeson uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_saeson is distinct from private.seneste_saeson(p_bodekasse) then
    raise exception 'tidligere_saeson';
  end if;
end $$;

-- An Admin annuls an Indbetaling registered by mistake, with an optional
-- note. The row stays (annulleret_*) but leaves Saldo and Kassen. It can't
-- be reversed or annulled twice. Returns {"indbetaling_id": uuid}.
-- Errors: ikke_medlem / ikke_admin (42501), ikke_fundet, allerede_annulleret,
--   tidligere_saeson.
-- Feed: art 'indbetaling_annulleret', aktoer = the Admin, modtager = who
--   paid, NO ref (so the entry itself isn't shown struck through),
--   data {indbetaling_id, navn, beloeb, note}.
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
  v_tidligere := private.start_kald(p_klient_id, 'annuller_indbetaling');
  if v_tidligere is not null then return v_tidligere; end if;

  select * into v_ind from public.indbetaling where id = p_indbetaling for update;
  if v_ind.id is null then raise exception 'ikke_fundet'; end if;
  v_mig := private.mit_admin(v_ind.bodekasse_id);
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

revoke execute on function public.annuller_indbetaling(uuid, uuid, text) from public, anon;
grant execute on function public.annuller_indbetaling(uuid, uuid, text) to authenticated;
