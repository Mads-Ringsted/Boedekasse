-- #65: Frikøb per Bødekategori.
--
-- A Medlem buys out one Bødekategori for the rest of the Sæson (or an Admin
-- registers it for them). Each Frikøb charges a Frikøbsgebyr at the box's
-- price of that moment. A Frikøb only blocks giving that Bødekategori to that
-- Medlem: it never enters a Saldo sum, so Engangsbøder, Gebyrer and a Bøde
-- moved by a won Anke always land. Archiving or repricing the Bødekategori
-- doesn't affect it. Turning the setting off only stops new purchases.
--
-- 1. Settings: frikob_til / frikob_pris go through opdater_indstillinger.
-- 2. public.frikob_aktiv: the Frikøb that cover someone right now.
-- 3. private.giv_linje (from #58) rejects a bought-out Bødekategori.
-- 4. public.koeb_frikob and public.annuller_frikob.

-- ---------- 1. Settings ----------
insert into private.indstilling (noegle) values ('frikob_til'), ('frikob_pris');

-- ---------- 2. Active Frikøb ----------
-- Not annulled, in the box's latest Sæson (a new Sæson starts fresh), with
-- the holder's and Bødekategori's names and the price paid (its Gebyr).
-- An archived Bødekategori keeps its Frikøb.
create view public.frikob_aktiv with (security_invoker = true) as
select f.id,
       f.bodekasse_id,
       f.saeson_id,
       f.medlem_id,
       m.navn          as medlem_navn,
       f.bodekategori_id,
       k.navn          as bodekategori_navn,
       f.koebt,
       f.registreret_af,
       g.beloeb        as pris
  from public.frikob f
  join public.bodekasse_saeson s on s.bodekasse_id = f.bodekasse_id and s.seneste_saeson_id = f.saeson_id
  join public.medlem m on m.id = f.medlem_id
  join public.bodekategori k on k.id = f.bodekategori_id
  left join public.gebyr g on g.frikob_id = f.id and g.annulleret is null
 where f.annulleret is null;

grant select on public.frikob_aktiv to authenticated;

-- ---------- 3. Giving checks the Frikøb ----------
-- Raises har_frikob when the Medlem holds a Frikøb on the Bødekategori in
-- this Sæson.
create function private.tjek_frikob(p_saeson uuid, p_medlem uuid, p_bodekategori uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if exists (select 1 from public.frikob
              where saeson_id = p_saeson and medlem_id = p_medlem
                and bodekategori_id = p_bodekategori and annulleret is null) then
    raise exception 'har_frikob';
  end if;
end $$;

-- From #58's definition, plus the Frikøb check in the Bødekategori part
-- (Engangsbøder are never covered).
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
  perform private.tjek_frikob(p_saeson, v_modtager.id, v_kategori.id);

  insert into public.bode (bodekasse_id, saeson_id, batch_id, giver_id, modtager_id,
                           bodekategori_id, pris)
  select p_bodekasse, p_saeson, p_batch, p_giver, v_modtager.id, v_kategori.id, v_kategori.pris
    from generate_series(1, v_antal);
end $$;

-- ---------- 4a. koeb_frikob ----------
-- Buys a Frikøb on one active Bødekategori for the rest of the running Sæson.
-- p_medlem null (or yourself): your own. Someone else: Admin only
-- ("Registrér frikøb"). The Medlem pays bodekasse.frikob_pris as a Gebyr
-- (art 'frikob') in the same transaction; the price is locked from then on.
-- Returns {"frikob_id": uuid, "beloeb": int}.
-- Errors: ikke_medlem / ikke_admin (42501), frikob_slaaet_fra, pause,
--   medlem_ukendt, modtager_udmeldt, ikke_fundet, arkiveret, frikob_findes.
-- Feed: art 'frikob_koebt', aktoer = who bought or registered it, modtager =
--   who it covers, ref frikob (so an annulment strikes it through and the
--   Gebyr shows on it), data {navn: Bødekategori name, beloeb}.
create function public.koeb_frikob(
  p_klient_id uuid, p_bodekasse uuid, p_bodekategori uuid, p_medlem uuid default null)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_mig       uuid := private.mit_medlem(p_bodekasse);
  v_medlem    public.medlem;
  v_kasse     public.bodekasse;
  v_kategori  public.bodekategori;
  v_saeson    uuid;
  v_tidligere jsonb;
  v_ny        uuid;
begin
  v_tidligere := private.start_kald(p_klient_id, 'koeb_frikob');
  if v_tidligere is not null then return v_tidligere; end if;

  if p_medlem is not null and p_medlem <> v_mig then
    perform private.mit_admin(p_bodekasse);
  end if;

  select * into v_kasse from public.bodekasse where id = p_bodekasse;
  if not v_kasse.frikob_til then raise exception 'frikob_slaaet_fra'; end if;
  v_saeson := private.aktiv_saeson(p_bodekasse);
  if v_saeson is null then raise exception 'pause'; end if;

  select * into v_medlem from public.medlem
   where bodekasse_id = p_bodekasse and id = coalesce(p_medlem, v_mig);
  if v_medlem.id is null then raise exception 'medlem_ukendt'; end if;
  if v_medlem.udmeldt is not null then raise exception 'modtager_udmeldt'; end if;

  select * into v_kategori from public.bodekategori
   where bodekasse_id = p_bodekasse and id = p_bodekategori;
  if v_kategori.id is null then raise exception 'ikke_fundet'; end if;
  if v_kategori.arkiveret is not null then raise exception 'arkiveret'; end if;

  begin
    insert into public.frikob (bodekasse_id, saeson_id, medlem_id, bodekategori_id, registreret_af)
    values (p_bodekasse, v_saeson, v_medlem.id, v_kategori.id, v_mig)
    returning id into v_ny;
  exception when unique_violation then
    raise exception 'frikob_findes';
  end;

  perform private.opret_gebyr(p_bodekasse, v_medlem.id, 'frikob', v_kasse.frikob_pris, v_ny);
  perform private.tilfoej_haendelse(
    p_bodekasse, v_mig, 'frikob_koebt',
    jsonb_build_object('navn', v_kategori.navn, 'beloeb', v_kasse.frikob_pris),
    'frikob', v_ny, p_modtager => v_medlem.id, p_saeson => v_saeson);

  return private.afslut_kald(p_klient_id,
    jsonb_build_object('frikob_id', v_ny, 'beloeb', v_kasse.frikob_pris));
end $$;

revoke execute on function public.koeb_frikob(uuid, uuid, uuid, uuid) from public, anon;
grant execute on function public.koeb_frikob(uuid, uuid, uuid, uuid) to authenticated;

-- ---------- 4b. annuller_frikob ----------
-- An Admin annuls a Frikøb in the latest Sæson (Pause included), with an
-- optional note. It stops covering at once, and its Frikøbsgebyr is annulled
-- too. Can't be reversed or annulled twice. Returns {"frikob_id": uuid}.
-- Errors: ikke_medlem / ikke_admin (42501), ikke_fundet, allerede_annulleret,
--   tidligere_saeson.
-- Feed: art 'frikob_annulleret', aktoer = the Admin, modtager = who it
--   covered, NO ref, data {frikob_id, navn: Bødekategori name, beloeb, note}.
create function public.annuller_frikob(p_klient_id uuid, p_frikob uuid, p_note text default null)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_note      text := nullif(btrim(p_note), '');
  v_frikob    public.frikob;
  v_mig       uuid;
  v_beloeb    int;
  v_tidligere jsonb;
begin
  v_tidligere := private.start_kald(p_klient_id, 'annuller_frikob');
  if v_tidligere is not null then return v_tidligere; end if;

  select * into v_frikob from public.frikob where id = p_frikob for update;
  if v_frikob.id is null then raise exception 'ikke_fundet'; end if;
  v_mig := private.mit_admin(v_frikob.bodekasse_id);
  if v_frikob.annulleret is not null then raise exception 'allerede_annulleret'; end if;
  perform private.tjek_seneste_saeson(v_frikob.bodekasse_id, v_frikob.saeson_id);

  update public.frikob
     set annulleret = now(), annulleret_af = v_mig, annulleret_note = v_note
   where id = v_frikob.id;
  update public.gebyr
     set annulleret = now(), annulleret_af = v_mig, annulleret_note = v_note
   where frikob_id = v_frikob.id and annulleret is null
  returning beloeb into v_beloeb;

  perform private.tilfoej_haendelse(
    v_frikob.bodekasse_id, v_mig, 'frikob_annulleret',
    jsonb_build_object('frikob_id', v_frikob.id,
                       'navn', (select navn from public.bodekategori where id = v_frikob.bodekategori_id),
                       'beloeb', coalesce(v_beloeb, 0), 'note', v_note),
    p_modtager => v_frikob.medlem_id, p_saeson => v_frikob.saeson_id);

  return private.afslut_kald(p_klient_id, jsonb_build_object('frikob_id', v_frikob.id));
end $$;

revoke execute on function public.annuller_frikob(uuid, uuid, text) from public, anon;
grant execute on function public.annuller_frikob(uuid, uuid, text) to authenticated;
