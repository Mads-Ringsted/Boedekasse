-- #76: Engangsbøde price modes.
--
-- An Admin picks how Engangsbøder are priced:
--   fri  : the giver types any amount (today's behaviour, the default).
--   fast : always engangs_pris kr; any amount the client sends is ignored.
--   loft : the giver types up to engangs_pris kr.
-- engangs_pris is required for fast and loft (a row check, so saving Fast or
-- Loft without an amount fails in opdater_indstillinger as indstilling_ugyldig).
-- The Engangsbøde Gebyr (engangsgebyr_til / engangsgebyr) is unchanged.
-- Additive: an enum, two columns with defaults, a check, and a new version of
-- private.giv_engangsbode. A Bøde keeps the price it was given with.

create type public.engangs_pris_mode as enum ('fri', 'fast', 'loft');

alter table public.bodekasse
  add column engangs_pris_mode public.engangs_pris_mode not null default 'fri',
  add column engangs_pris      int check (engangs_pris > 0),
  add constraint bodekasse_engangs_pris_kraevet
    check (engangs_pris_mode = 'fri' or engangs_pris is not null);

-- Both are Indstillinger (opdater_indstillinger, #57). The column type and
-- checks guard them.
insert into private.indstilling (noegle) values ('engangs_pris_mode'), ('engangs_pris');

-- giv_engangsbode (from #58) + the price mode. Errors as before (grund_mangler,
-- grund_for_lang, beloeb_ugyldig), plus beloeb_over_loft in Loft mode.
-- In Fast mode the line's "beloeb" is ignored, so it may be missing.
create or replace function private.giv_engangsbode(
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

  select * into v_kasse from public.bodekasse where id = p_bodekasse;

  if v_kasse.engangs_pris_mode = 'fast' then
    v_beloeb := v_kasse.engangs_pris;
  else
    if v_beloeb is null or v_beloeb < 1 or v_beloeb > 2147483647 or v_beloeb <> trunc(v_beloeb) then
      raise exception 'beloeb_ugyldig';
    end if;
    if v_kasse.engangs_pris_mode = 'loft' and v_beloeb > v_kasse.engangs_pris then
      raise exception 'beloeb_over_loft';
    end if;
  end if;

  insert into public.bode (bodekasse_id, saeson_id, batch_id, giver_id, modtager_id, grund, pris)
  values (p_bodekasse, p_saeson, p_batch, p_giver, p_modtager, v_grund, v_beloeb::int)
  returning id into v_bode;

  if v_kasse.engangsgebyr_til then
    perform private.opret_gebyr(p_bodekasse, p_giver, 'engangsbode', v_kasse.engangsgebyr, v_bode);
  end if;
end $$;
