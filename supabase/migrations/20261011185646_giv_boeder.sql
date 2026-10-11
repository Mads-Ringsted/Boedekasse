-- #53: Giv bøder and Fortryd.
--
-- One submit of Giv bøder is one call to giv_boeder, which creates one batch
-- (bode.batch_id) in the running Sæson. Each Bøde keeps the price its
-- Bødekategori had at that moment. Fortryd (fortryd_batch) hard-deletes the
-- whole batch: only its giver, only within a short grace after giving.
--
-- p_linjer is a JSON array of lines. A line today:
--   {"modtager_id": uuid, "bodekategori_id": uuid, "antal": int}
-- Later tickets extend private.giv_linje (create or replace):
--   #58 Engangsbøde: a line with "grund" + "beloeb" instead of a Bødekategori,
--       plus the giver's Gebyr (gebyr.bode_id, which fortryd_batch already deletes).
--   #65 Frikøb: reject a Bødekategori the receiver has bought out.
--
-- Feed: one entry per receiver per batch, art 'boeder_givet', aktoer = giver,
-- batch_id + modtager_id set, no ref. data:
--   {"antal": 3, "beloeb": 120,
--    "linjer": [{"navn": "For sent", "pris": 50, "antal": 2, "bodekategori_id": uuid}, ...]}
-- (linjer sorted by name; "navn" is the Bødekategori name at giving time).

-- How long after giving its giver may still Fortryd a batch. The app's toast
-- shows for about 8 seconds; the rest is slack for a slow network.
create function private.fortryd_frist() returns interval
language sql immutable set search_path = '' as $$ select interval '30 seconds' $$;

-- A uuid from JSON text, or null when it isn't one.
create function private.som_uuid(p_tekst text) returns uuid
language plpgsql immutable set search_path = '' as $$
begin
  return p_tekst::uuid;
exception when invalid_text_representation then
  return null;
end $$;

-- Validates one line of a Giv bøder submit and inserts its Bøder.
-- Errors: modtager_ukendt, modtager_udmeldt, ikke_dig_selv, antal_ugyldig
-- (a whole number 1-99), ikke_fundet, arkiveret.
create function private.giv_linje(
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

-- ---------- giv_boeder ----------
-- Any active Medlem, running Sæson only. All lines or none.
-- Returns {"batch_id": uuid, "antal": int, "beloeb": int}.
-- Errors: ikke_medlem (42501), pause, ingen_boeder, and giv_linje's.
create function public.giv_boeder(p_klient_id uuid, p_bodekasse uuid, p_linjer jsonb)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_mig       uuid := private.mit_medlem(p_bodekasse);
  v_tidligere jsonb;
  v_saeson    uuid;
  v_batch     uuid := gen_random_uuid();
  v_linje     jsonb;
  v_r         record;
  v_antal     int := 0;
  v_beloeb    int := 0;
begin
  v_tidligere := private.start_kald(p_klient_id, 'giv_boeder');
  if v_tidligere is not null then return v_tidligere; end if;

  v_saeson := private.aktiv_saeson(p_bodekasse);
  if v_saeson is null then raise exception 'pause'; end if;
  if jsonb_typeof(p_linjer) is distinct from 'array' or jsonb_array_length(p_linjer) = 0 then
    raise exception 'ingen_boeder';
  end if;

  for v_linje in select * from jsonb_array_elements(p_linjer) loop
    perform private.giv_linje(p_bodekasse, v_saeson, v_batch, v_mig, v_linje);
  end loop;

  -- One feed entry per receiver.
  for v_r in
    select l.modtager_id,
           sum(l.antal)::int          as antal,
           sum(l.antal * l.pris)::int as beloeb,
           jsonb_agg(jsonb_build_object('navn', l.navn, 'pris', l.pris, 'antal', l.antal,
                                        'bodekategori_id', l.bodekategori_id)
                     order by lower(l.navn), l.pris) as linjer
      from (select b.modtager_id, b.bodekategori_id, coalesce(k.navn, b.grund) as navn,
                   b.pris, count(*) as antal
              from public.bode b
              left join public.bodekategori k on k.id = b.bodekategori_id
             where b.batch_id = v_batch
             group by b.modtager_id, b.bodekategori_id, coalesce(k.navn, b.grund), b.pris) l
     group by l.modtager_id
  loop
    perform private.tilfoej_haendelse(
      p_bodekasse, v_mig, 'boeder_givet',
      jsonb_build_object('antal', v_r.antal, 'beloeb', v_r.beloeb, 'linjer', v_r.linjer),
      p_batch_id => v_batch, p_modtager => v_r.modtager_id, p_saeson => v_saeson);
    v_antal := v_antal + v_r.antal;
    v_beloeb := v_beloeb + v_r.beloeb;
  end loop;

  return private.afslut_kald(p_klient_id,
    jsonb_build_object('batch_id', v_batch, 'antal', v_antal, 'beloeb', v_beloeb));
end $$;

revoke execute on function public.giv_boeder(uuid, uuid, jsonb) from public, anon;
grant execute on function public.giv_boeder(uuid, uuid, jsonb) to authenticated;

-- ---------- fortryd_batch ----------
-- Hard-deletes a whole Giv batch with its feed entries and any Gebyr caused
-- by its Bøder (#58's Engangsbøde Gebyr), leaving no trace. Only the giver,
-- only within private.fortryd_frist() of giving. Returns {"batch_id": uuid}.
-- Errors: ikke_fundet, ikke_medlem / ikke_tilladt (42501), fortryd_udloebet,
-- kan_ikke_fortrydes (something already points at one of its Bøder, e.g. an Anke).
create function public.fortryd_batch(p_klient_id uuid, p_batch uuid)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_tidligere jsonb;
  v_bode      public.bode;
begin
  v_tidligere := private.start_kald(p_klient_id, 'fortryd_batch');
  if v_tidligere is not null then return v_tidligere; end if;

  select * into v_bode from public.bode where batch_id = p_batch order by givet limit 1;
  if v_bode.id is null then raise exception 'ikke_fundet'; end if;
  if private.mit_medlem(v_bode.bodekasse_id) <> v_bode.giver_id then
    raise exception 'ikke_tilladt' using errcode = '42501';
  end if;
  perform 1 from public.bode where batch_id = p_batch for update;
  if now() > v_bode.givet + private.fortryd_frist() then
    raise exception 'fortryd_udloebet';
  end if;

  begin
    delete from public.haendelse where batch_id = p_batch;
    delete from public.gebyr
     where bode_id in (select id from public.bode where batch_id = p_batch);
    delete from public.bode where batch_id = p_batch;
  exception when foreign_key_violation then
    raise exception 'kan_ikke_fortrydes';
  end;
  return private.afslut_kald(p_klient_id, jsonb_build_object('batch_id', p_batch));
end $$;

revoke execute on function public.fortryd_batch(uuid, uuid) from public, anon;
grant execute on function public.fortryd_batch(uuid, uuid) to authenticated;
