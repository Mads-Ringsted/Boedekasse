-- A Medlem can give a Bøde to themself. From #65's giv_linje (Engangsbøde
-- branch and Frikøb check kept), minus the ikke_dig_selv rejection.
create or replace function private.giv_linje(
  p_bodekasse uuid, p_saeson uuid, p_batch uuid, p_giver uuid, p_linje jsonb)
returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_modtager public.medlem;
  v_kategori public.bodekategori;
  v_antal    int;
begin
  select * into v_modtager from public.medlem
   where bodekasse_id = p_bodekasse and id = private.som_uuid(p_linje ->> 'modtager_id');
  if v_modtager.id is null then raise exception 'modtager_ukendt'; end if;
  if v_modtager.udmeldt is not null then raise exception 'modtager_udmeldt'; end if;

  if p_linje ? 'grund' then
    perform private.giv_engangsbode(p_bodekasse, p_saeson, p_batch, p_giver, v_modtager.id, p_linje);
    return;
  end if;

  v_antal := case when jsonb_typeof(p_linje -> 'antal') = 'number'
                  then (p_linje ->> 'antal')::numeric end;
  if v_antal is null or v_antal < 1 or v_antal > 99 or v_antal <> (p_linje ->> 'antal')::numeric then
    raise exception 'antal_ugyldig';
  end if;

  select * into v_kategori from public.bodekategori
   where bodekasse_id = p_bodekasse and id = private.som_uuid(p_linje ->> 'bodekategori_id');
  if v_kategori.id is null then raise exception 'ikke_fundet'; end if;
  if v_kategori.arkiveret is not null then raise exception 'arkiveret'; end if;
  perform private.tjek_frikob(p_saeson, v_modtager.id, v_kategori.id);

  insert into public.bode (bodekasse_id, saeson_id, batch_id, giver_id, modtager_id,
                           bodekategori_id, pris)
  select p_bodekasse, p_saeson, p_batch, p_giver, v_modtager.id, v_kategori.id, v_kategori.pris
    from generate_series(1, v_antal);
end $$;
