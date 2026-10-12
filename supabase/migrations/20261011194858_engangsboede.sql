-- #58: Engangsbøde and its Gebyr.
--
-- An Engangsbøde is a Giv bøder line with a free-text reason and an amount
-- instead of a Bødekategori:
--   {"modtager_id": uuid, "grund": text, "beloeb": int}
-- It becomes one Bøde (bodekategori_id null, grund set, pris = beloeb) in the
-- batch. When the box has the Engangsbøde Gebyr on, the giver pays it
-- (gebyr art 'engangsbode', bode_id = the Bøde) in the same transaction.
-- Fortryd already deletes it; the aktivitet views already show it on the
-- Bøde's row (aktivitet_bode.gebyr). The feed entry's linjer get the reason
-- as "navn" and a null bodekategori_id (giv_boeder already does that).

-- The Engangsbøde Gebyr is an Indstilling (opdater_indstillinger, #57).
insert into private.indstilling (noegle) values ('engangsgebyr_til'), ('engangsgebyr');

-- Gives one Engangsbøde to an already checked receiver, plus the giver's
-- Gebyr when the rule is on. Errors: grund_mangler, grund_for_lang (over
-- 100 characters), beloeb_ugyldig (a whole number of kroner above 0).
create function private.giv_engangsbode(
  p_bodekasse uuid, p_saeson uuid, p_batch uuid, p_giver uuid, p_modtager uuid, p_linje jsonb)
returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_grund  text := btrim(case when jsonb_typeof(p_linje -> 'grund') = 'string' then p_linje ->> 'grund' end);
  v_beloeb numeric := case when jsonb_typeof(p_linje -> 'beloeb') = 'number'
                           then (p_linje ->> 'beloeb')::numeric end;
  v_kasse  public.bodekasse;
  v_bode   uuid;
begin
  if v_grund is null or v_grund = '' then raise exception 'grund_mangler'; end if;
  if length(v_grund) > 100 then raise exception 'grund_for_lang'; end if;
  if v_beloeb is null or v_beloeb < 1 or v_beloeb > 2147483647 or v_beloeb <> trunc(v_beloeb) then
    raise exception 'beloeb_ugyldig';
  end if;

  insert into public.bode (bodekasse_id, saeson_id, batch_id, giver_id, modtager_id, grund, pris)
  values (p_bodekasse, p_saeson, p_batch, p_giver, p_modtager, v_grund, v_beloeb::int)
  returning id into v_bode;

  select * into v_kasse from public.bodekasse where id = p_bodekasse;
  if v_kasse.engangsgebyr_til then
    perform private.opret_gebyr(p_bodekasse, p_giver, 'engangsbode', v_kasse.engangsgebyr, v_bode);
  end if;
end $$;

-- giv_linje (from #53) + the Engangsbøde branch: a line with "grund" is an
-- Engangsbøde (its "antal" and "bodekategori_id" are ignored). The rest is
-- unchanged. Errors: modtager_ukendt, modtager_udmeldt, ikke_dig_selv,
-- antal_ugyldig (a whole number 1-99), ikke_fundet, arkiveret, and
-- giv_engangsbode's.
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
  if v_modtager.id = p_giver then raise exception 'ikke_dig_selv'; end if;

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

  insert into public.bode (bodekasse_id, saeson_id, batch_id, giver_id, modtager_id,
                           bodekategori_id, pris)
  select p_bodekasse, p_saeson, p_batch, p_giver, v_modtager.id, v_kategori.id, v_kategori.pris
    from generate_series(1, v_antal);
end $$;
