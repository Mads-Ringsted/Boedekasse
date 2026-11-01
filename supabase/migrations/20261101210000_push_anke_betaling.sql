-- #82 (spec #74 "Push"): pushes for Anke and payment events.
--
--   anke_afstemning          an Anke opens: every active Medlem who may decide it
--   anke_resultat            an Anke gets (or changes) its verdict: its two parties
--   betalingsmelding_venter  a Betalingsmelding waits: the box's active Admins and
--                            Kasserere, never the one who reported it
--   betaling_bekraeftet      a Betalingsmelding is confirmed: the one who paid
--
-- Additive only: functions and triggers. Like #81's Bøde modtaget, each push
-- is a trigger on the row the event already writes (a feed entry in
-- public.haendelse, or the new public.betalingsmelding), so no RPC is
-- redefined. private.push applies each recipient's toggle and names the box
-- in the link. Every title names the Bødekasse.

-- ---------- Anke afstemning ----------
-- indgiv_anke writes 'anke_indgivet': aktoer = the receiver (who appeals),
-- modtager = the giver, data {bode_id, navn, pris}. Anyone but those two may
-- record the verdict (afgoer_anke), so every other active Medlem with a login
-- gets the push. The link opens the Bøde on Anker, where the verdict goes.
create function private.push_anke_indgivet() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_kasse     text;
  v_appellant text;
  v_giver     text;
  v_tekst     text;
  v_m         record;
begin
  select navn into v_kasse from public.bodekasse where id = new.bodekasse_id;
  select navn into v_appellant from public.medlem where id = new.aktoer_id;
  select navn into v_giver from public.medlem where id = new.modtager_id;
  v_tekst := coalesce(v_appellant, 'Nogen') || ' anker ' || coalesce(new.data ->> 'navn', 'en bøde')
          || ' (' || private.kr(coalesce((new.data ->> 'pris')::int, 0)) || ')'
          || ' fra ' || coalesce(v_giver, 'nogen') || '. Afgør den nu.';

  for v_m in
    select user_id from public.medlem
     where bodekasse_id = new.bodekasse_id and udmeldt is null and user_id is not null
       and id is distinct from new.aktoer_id and id is distinct from new.modtager_id
  loop
    perform private.push(
      v_m.user_id, 'anke_afstemning', new.bodekasse_id,
      'Ny anke i ' || v_kasse, v_tekst,
      '/anker?bode=' || (new.data ->> 'bode_id'),
      null, new.id);
  end loop;
  return null;
end $$;

create trigger push_anke_indgivet after insert on public.haendelse
  for each row when (new.art = 'anke_indgivet')
  execute function private.push_anke_indgivet();

-- ---------- Anke resultat ----------
-- saet_afgoerelse writes 'anke_afgjort' for a first verdict (afgoer_anke) and
-- for a changed one (aendr_afgoerelse, data.aendret): aktoer = who decided,
-- modtager = the giver, data {bode_id, navn, pris, afgoerelse, aendret,
-- appellant_id, appellant_navn}. Both parties hear who now pays, except a
-- party who recorded it themselves or is Udmeldt. A self-given Bøde has one
-- party.
-- (An Anke closed as "Ikke afgjort" by a new Sæson writes no feed entry and
-- no push.)
create function private.push_anke_afgjort() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_kasse     text;
  v_giver_id  uuid := new.modtager_id;
  v_app_id    uuid := (new.data ->> 'appellant_id')::uuid;
  v_giver     text;
  v_appellant text := coalesce(new.data ->> 'appellant_navn', 'Nogen');
  v_vandt     boolean := new.data ->> 'afgoerelse' = 'modtager_vandt';
  v_bode      text := coalesce(new.data ->> 'navn', 'bøden')
                   || ' (' || private.kr(coalesce((new.data ->> 'pris')::int, 0)) || ')';
  v_titel     text;
  v_sti       text := '/anker?bode=' || (new.data ->> 'bode_id');
begin
  if new.data ->> 'afgoerelse' not in ('modtager_vandt', 'giver_vandt') then
    return null;
  end if;
  select navn into v_kasse from public.bodekasse where id = new.bodekasse_id;
  select navn into v_giver from public.medlem where id = v_giver_id;
  v_giver := coalesce(v_giver, 'Nogen');
  v_titel := case when coalesce((new.data ->> 'aendret')::boolean, false)
                  then 'Afgørelse ændret i ' else 'Anke afgjort i ' end || v_kasse;

  -- The appellant (the Bøde's receiver).
  if v_app_id is distinct from new.aktoer_id then
    perform private.push(
      (select user_id from public.medlem where id = v_app_id and udmeldt is null),
      'anke_resultat', new.bodekasse_id, v_titel,
      case when v_vandt then 'Du vandt anken. ' || v_giver || ' betaler ' || v_bode || '.'
           else 'Bøden står ved magt. Du betaler ' || v_bode || '.' end,
      v_sti, null, new.id);
  end if;
  -- The giver.
  if v_giver_id is distinct from v_app_id and v_giver_id is distinct from new.aktoer_id then
    perform private.push(
      (select user_id from public.medlem where id = v_giver_id and udmeldt is null),
      'anke_resultat', new.bodekasse_id, v_titel,
      case when v_vandt then v_appellant || ' vandt anken. Du betaler ' || v_bode || '.'
           else 'Bøden står ved magt. ' || v_appellant || ' betaler ' || v_bode || '.' end,
      v_sti, null, new.id);
  end if;
  return null;
end $$;

create trigger push_anke_afgjort after insert on public.haendelse
  for each row when (new.art = 'anke_afgjort')
  execute function private.push_anke_afgjort();

-- ---------- Betalingsmelding venter ----------
-- meld_betaling writes no feed entry while the report waits, so this one
-- triggers on the new public.betalingsmelding row. It goes to the box's
-- active Admins and Kasserere (who may handle it, private.mine_penge), never
-- to the one who reported it, even an Admin who could confirm their own.
-- The link opens Kassen, which lists the waiting reports with Afvis / Bekræft.
create function private.push_betalingsmelding() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_kasse  text;
  v_navn   text;
  v_m      record;
begin
  if new.status <> 'afventer' then return null; end if;
  select navn into v_kasse from public.bodekasse where id = new.bodekasse_id;
  select navn into v_navn from public.medlem where id = new.medlem_id;
  for v_m in
    select user_id from public.medlem
     where bodekasse_id = new.bodekasse_id and udmeldt is null and user_id is not null
       and (er_admin or er_kasserer) and id <> new.medlem_id
  loop
    perform private.push(
      v_m.user_id, 'betalingsmelding_venter', new.bodekasse_id,
      'Betaling venter i ' || v_kasse,
      coalesce(v_navn, 'Nogen') || ' har betalt ' || private.kr(new.beloeb)
        || '. Bekræft eller afvis den.',
      '/kassen');
  end loop;
  return null;
end $$;

create trigger push_betalingsmelding after insert on public.betalingsmelding
  for each row execute function private.push_betalingsmelding();

-- ---------- Betaling bekræftet ----------
-- behandl_betalingsmelding writes 'betaling_bekraeftet' on confirming:
-- aktoer = who confirmed, modtager = who paid, data {navn, beloeb}. The payer
-- hears it, unless they confirmed it themselves (an Admin's own report).
-- A rejection ('betaling_afvist') has no push kind and sends nothing.
-- The link opens the payer's own Profil, with the new balance.
create function private.push_betaling_bekraeftet() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_login  uuid;
  v_kasse  text;
  v_af     text;
begin
  if new.modtager_id is null or new.modtager_id is not distinct from new.aktoer_id then
    return null;
  end if;
  select user_id into v_login from public.medlem where id = new.modtager_id and udmeldt is null;
  if v_login is null then return null; end if;
  select navn into v_kasse from public.bodekasse where id = new.bodekasse_id;
  select navn into v_af from public.medlem where id = new.aktoer_id;
  perform private.push(
    v_login, 'betaling_bekraeftet', new.bodekasse_id,
    'Betaling bekræftet i ' || v_kasse,
    coalesce(v_af, 'Nogen') || ' bekræftede din betaling på '
      || private.kr(coalesce((new.data ->> 'beloeb')::int, 0)) || '.',
    '/profil', null, new.id);
  return null;
end $$;

create trigger push_betaling_bekraeftet after insert on public.haendelse
  for each row when (new.art = 'betaling_bekraeftet')
  execute function private.push_betaling_bekraeftet();
