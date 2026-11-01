-- #88 (spec #74 "Push"): the push kind "Aktivitet fra andre", part 2.
--
-- An opt-in push about every entry in the activity feed (public.haendelse)
-- of the person's Bødekasser: Bøder, Anker, Gebyrer (the automatic ones
-- too), Indbetalinger, Hævninger, Konkurrencer, Frikøb, Annulleringer, and
-- the rest of the feed (Medlemmer, Sæsoner, Bødekategorier). One trigger on
-- the feed covers every kind, so a new kind of entry is covered as well.
--
-- Recipients of one entry: every active Medlem of the box with a login and
-- the toggle on, except
--   - the one who did it: the entry's aktoer and the logged-in caller (a
--     Dos-bonus entry has no aktoer, but the giver whose Giv charged it is
--     the caller);
--   - anyone the entry already notifies through their own push type
--     (private.andres_beroerte), whatever their own toggle says. So nobody
--     hears about the same entry twice, and turning your own kind off never
--     moves those entries into this one.
--
-- Batching: one push per login, box and statement, like the automatic-Gebyr
-- push (#83, private.push_samling) and with the same key. A Giv is one RPC
-- call, so one statement; a scheduler run is one statement too. The first
-- entry queues the push; each later one adds its line and rewrites the title
-- and text (private.andres_samling holds the lines).
--
-- Fortryd: a push with a Giv's entries (its Bøder or the Dos-bonuses it
-- charged) waits out the Fortryd grace, like the Bøde push. It links its
-- first entry, which is one of the batch's, so Fortryd deletes the entries
-- and with them the unsent push.
--
-- Redefined: private.push_til (from 20261101190000_push.sql), so a login
-- with no stored toggles has this kind off. No RPC is redefined.

-- ---------- The toggle's default ----------

-- push_til (from 20261101190000_push.sql): is this kind of push on for this
-- login? No row = the column's default: on for every kind but the opt-in
-- 'andres_aktivitet'.
create or replace function private.push_til(p_login uuid, p_art public.push_art) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select (to_jsonb(p) ->> p_art::text)::boolean
       from public.push_praeference p where p.user_id = p_login),
    p_art <> 'andres_aktivitet')
$$;

-- ---------- Who the entry already notifies ----------

-- The Medlemmer an entry already reaches through their own push type, as the
-- triggers of #81, #82 and #83 pick them, ignoring toggles and logins:
--   boeder_givet         the receiver (bode_modtaget)
--   anke_indgivet        every active Medlem but the two parties (anke_afstemning)
--   anke_afgjort         the appellant and the giver (anke_resultat)
--   betaling_bekraeftet  the payer (betaling_bekraeftet)
--   the automatic Gebyrer the payer (automatisk_gebyr)
-- A Betalingsmelding venter push comes from public.betalingsmelding, not the
-- feed, and payment reminders from the scheduler, so neither is here.
create function private.andres_beroerte(p_h public.haendelse) returns uuid[]
language sql stable security definer set search_path = '' as $$
  select case
    when p_h.art in ('boeder_givet', 'betaling_bekraeftet',
                     'dos_bonus', 'catch_up', 'sen_betaling', 'tilbagevendende')
      then array_remove(array[p_h.modtager_id], null)
    when p_h.art = 'anke_indgivet'
      then coalesce((select array_agg(m.id) from public.medlem m
                      where m.bodekasse_id = p_h.bodekasse_id and m.udmeldt is null
                        and m.id is distinct from p_h.aktoer_id
                        and m.id is distinct from p_h.modtager_id), '{}')
    when p_h.art = 'anke_afgjort' and p_h.data ->> 'afgoerelse' in ('modtager_vandt', 'giver_vandt')
      then array_remove(array[(p_h.data ->> 'appellant_id')::uuid, p_h.modtager_id], null)
    else '{}'::uuid[]
  end
$$;

-- ---------- One entry as a line ----------

-- A Medlem's name in a line to p_mig: "Du"/"dig" for p_mig, else the name.
create function private.andres_navn(p_medlem uuid, p_mig uuid, p_subjekt boolean) returns text
language sql stable security definer set search_path = '' as $$
  select case
    when p_medlem = p_mig then case when p_subjekt then 'Du' else 'dig' end
    else coalesce((select navn from public.medlem where id = p_medlem),
                  case when p_subjekt then 'Nogen' else 'nogen' end)
  end
$$;

-- One entry as {tekst, beloeb} for the Medlem p_mig, following the feed's
-- wording: "Anna gav Bo For sent ×2" with beloeb 40. beloeb is null when the
-- entry has no amount. An unknown kind is "Ny aktivitet".
create function private.andres_linje(p_h public.haendelse, p_mig uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  d       jsonb := p_h.data;
  v_a     text := private.andres_navn(p_h.aktoer_id, p_mig, true);
  v_ms    text := private.andres_navn(p_h.modtager_id, p_mig, true);
  v_mo    text := private.andres_navn(p_h.modtager_id, p_mig, false);
  v_navn  text := coalesce(nullif(btrim(d ->> 'navn'), ''), '');
  v_titel text := coalesce(nullif(btrim(d ->> 'titel'), ''), '');
  v_tekst text;
  v_kr    int := (d ->> 'beloeb')::int;
begin
  case p_h.art
    when 'boeder_givet' then
      select v_a || ' gav ' || v_mo || ' '
             || coalesce(string_agg(l ->> 'navn' || case when (l ->> 'antal')::int > 1
                                                        then ' ×' || (l ->> 'antal') else '' end,
                                    ', ' order by ord), 'bøder')
        into v_tekst
        from jsonb_array_elements(coalesce(d -> 'linjer', '[]'::jsonb)) with ordinality as x(l, ord);
    when 'anke_indgivet' then
      v_tekst := v_a || ' ankede ' || v_navn || ' fra ' || v_mo;
      v_kr := (d ->> 'pris')::int;
    when 'anke_afgjort' then
      v_tekst := private.andres_navn((d ->> 'appellant_id')::uuid, p_mig, true)
              || case when d ->> 'afgoerelse' = 'modtager_vandt' then ' vandt' else ' tabte' end
              || ' anken mod ' || v_mo || ': ' || v_navn;
      v_kr := (d ->> 'pris')::int;
    when 'bode_annulleret' then
      v_tekst := v_a || ' annullerede '
              || case when (d ->> 'engangsbode')::boolean then 'en engangsbøde' else 'en bøde' end
              || ' til ' || v_mo || ': ' || v_navn;
      v_kr := (d ->> 'pris')::int;
    when 'gebyr_annulleret' then v_tekst := v_a || ' annullerede et gebyr til ' || v_mo;
    when 'indbetaling' then v_tekst := v_a || ' registrerede en indbetaling fra ' || v_mo;
    when 'indbetaling_annulleret' then v_tekst := v_a || ' annullerede en indbetaling fra ' || v_mo;
    when 'betaling_bekraeftet' then v_tekst := v_a || ' bekræftede en betaling fra ' || v_mo;
    when 'betaling_afvist' then v_tekst := v_a || ' afviste en betaling fra ' || v_mo;
    when 'haevning' then
      v_tekst := v_a || ' hævede penge' || coalesce(': ' || nullif(btrim(d ->> 'formaal'), ''), '');
    when 'haevning_annulleret' then v_tekst := v_a || ' annullerede en hævning';
    when 'frikob_koebt' then v_tekst := v_ms || ' købte Frikøb på ' || v_navn;
    when 'frikob_annulleret' then v_tekst := v_a || ' annullerede et frikøb til ' || v_mo;
    when 'konkurrence_registreret' then v_tekst := 'Konkurrence: ' || v_titel;
    when 'konkurrence_annulleret' then v_tekst := v_a || ' annullerede konkurrencen ' || v_titel;
    when 'dos_bonus' then v_tekst := v_ms || ' fik en Dos-bonus';
    when 'catch_up' then v_tekst := v_ms || ' fik catch-up';
    when 'sen_betaling' then v_tekst := v_ms || ' fik gebyr for sen betaling';
    when 'tilbagevendende' then v_tekst := v_ms || ' fik gebyret ' || v_navn;
    when 'bodekategori_oprettet' then
      v_tekst := v_a || ' oprettede bødekategorien ' || v_navn;
      v_kr := (d ->> 'pris')::int;
    when 'bodekategori_ompriset' then
      v_tekst := v_a || ' ændrede prisen på ' || v_navn || ' til '
              || private.kr(coalesce((d ->> 'ny_pris')::int, 0));
      v_kr := null;
    when 'bodekategori_arkiveret' then v_tekst := v_a || ' arkiverede ' || v_navn; v_kr := null;
    when 'medlem_tilfoejet' then v_tekst := v_a || ' tilføjede ' || v_mo;
    when 'medlem_tilmeldt' then v_tekst := v_a || ' kom med';
    when 'medlem_udmeldt' then v_tekst := v_a || ' meldte ' || v_mo || ' ud';
    when 'medlem_genoptaget' then v_tekst := v_a || ' genoptog ' || v_mo;
    when 'saeson_startet' then v_tekst := coalesce(d ->> 'saeson_navn', 'En ny sæson') || ' startede';
    when 'saeson_afsluttet' then v_tekst := coalesce(d ->> 'saeson_navn', 'Sæsonen') || ' sluttede';
    else v_tekst := 'Ny aktivitet';
  end case;
  return jsonb_build_object('tekst', v_tekst, 'beloeb', v_kr);
end $$;

-- "Ny aktivitet i <box>" / "<n> nye aktiviteter i <box>".
create function private.andres_titel(p_antal int, p_kasse text) returns text
language sql immutable set search_path = '' as $$
  select case when p_antal = 1 then 'Ny aktivitet i ' else p_antal || ' nye aktiviteter i ' end || p_kasse
$$;

-- The lines [{tekst, beloeb, antal}], one per row, in order of first
-- appearance: "Anna gav Bo For sent ×2 · 40 kr", "Dan fik gebyr for sen
-- betaling ×3 · 75 kr". At most 5 lines, then "+ <n> mere".
create function private.andres_tekst(p_linjer jsonb) returns text
language sql immutable set search_path = '' as $$
  select string_agg(
           case when ord <= 5 then
             l ->> 'tekst'
             || case when (l ->> 'antal')::int > 1 then ' ×' || (l ->> 'antal') else '' end
             || coalesce(' · ' || private.kr((l ->> 'beloeb')::int), '')
           else '+ ' || (jsonb_array_length(p_linjer) - 5) || ' mere' end,
           E'\n' order by ord)
    from jsonb_array_elements(p_linjer) with ordinality as x(l, ord)
   where ord <= 6
$$;

-- ---------- The push ----------

-- The running batch of one login, box and statement (see the header).
create table private.andres_samling (
  udbakke_id    bigint primary key references public.push_udbakke on delete cascade,
  noegle        text not null,
  user_id       uuid not null,
  bodekasse_id  uuid not null,
  linjer        jsonb not null,   -- [{tekst, beloeb, antal}], in order of first appearance
  antal         int not null,     -- feed entries in the push
  unique (user_id, bodekasse_id, noegle)
);

create function private.push_andres_aktivitet() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_noegle     text := txid_current() || '@' || statement_timestamp();
  v_mig        uuid := (select auth.uid());
  v_beroerte   uuid[];
  v_send_efter timestamptz;
  v_kasse      text;
  v_m          record;
  v_linje      jsonb;
  v_s          private.andres_samling;
  v_id         bigint;
begin
  -- Nobody in the box opted in: nothing to do.
  if not exists (select 1 from public.medlem m
                  where m.bodekasse_id = new.bodekasse_id and m.udmeldt is null
                    and m.user_id is not null
                    and private.push_til(m.user_id, 'andres_aktivitet')) then
    return null;
  end if;

  v_beroerte := private.andres_beroerte(new);
  select navn into v_kasse from public.bodekasse where id = new.bodekasse_id;
  -- A Giv's entries can still be taken back by Fortryd.
  if new.art = 'boeder_givet'
     or (new.art = 'dos_bonus'
         and exists (select 1 from public.gebyr where id = new.ref_id and dos_batch_id is not null)) then
    v_send_efter := now() + private.fortryd_frist();
  end if;

  for v_m in
    select m.id, m.user_id from public.medlem m
     where m.bodekasse_id = new.bodekasse_id and m.udmeldt is null and m.user_id is not null
       and m.id is distinct from new.aktoer_id
       and m.user_id is distinct from v_mig
       and m.id <> all (v_beroerte)
       and private.push_til(m.user_id, 'andres_aktivitet')
  loop
    v_linje := private.andres_linje(new, v_m.id) || jsonb_build_object('antal', 1);

    -- Only the current statement's batch is needed; older ones are done.
    delete from private.andres_samling
     where user_id = v_m.user_id and bodekasse_id = new.bodekasse_id and noegle <> v_noegle;
    select * into v_s from private.andres_samling
     where user_id = v_m.user_id and bodekasse_id = new.bodekasse_id and noegle = v_noegle;

    if v_s.udbakke_id is null then
      v_id := private.push(
        v_m.user_id, 'andres_aktivitet', new.bodekasse_id,
        private.andres_titel(1, v_kasse),
        private.andres_tekst(jsonb_build_array(v_linje)),
        '/aktivitet', v_send_efter, new.id);
      if v_id is not null then
        insert into private.andres_samling (udbakke_id, noegle, user_id, bodekasse_id, linjer, antal)
        values (v_id, v_noegle, v_m.user_id, new.bodekasse_id, jsonb_build_array(v_linje), 1);
      end if;
    else
      -- The same line again (three late days for Dan) counts up; amounts add.
      v_s.linjer := case
        when exists (select 1 from jsonb_array_elements(v_s.linjer) l
                      where l ->> 'tekst' = v_linje ->> 'tekst')
        then (select jsonb_agg(case when l ->> 'tekst' = v_linje ->> 'tekst'
                                    then l || jsonb_build_object(
                                           'antal', (l ->> 'antal')::int + 1,
                                           'beloeb', (l ->> 'beloeb')::int + (v_linje ->> 'beloeb')::int)
                                    else l end order by ord)
                from jsonb_array_elements(v_s.linjer) with ordinality as x(l, ord))
        else v_s.linjer || jsonb_build_array(v_linje) end;
      v_s.antal := v_s.antal + 1;
      update private.andres_samling
         set linjer = v_s.linjer, antal = v_s.antal
       where udbakke_id = v_s.udbakke_id;
      update public.push_udbakke
         set titel = private.andres_titel(v_s.antal, v_kasse),
             tekst = private.andres_tekst(v_s.linjer),
             send_efter = greatest(send_efter, coalesce(v_send_efter, send_efter))
       where id = v_s.udbakke_id;
    end if;
  end loop;
  return null;
end $$;

create trigger push_andres_aktivitet after insert on public.haendelse
  for each row execute function private.push_andres_aktivitet();

revoke execute on function private.andres_beroerte(public.haendelse) from public, anon, authenticated;
revoke execute on function private.andres_navn(uuid, uuid, boolean) from public, anon, authenticated;
revoke execute on function private.andres_linje(public.haendelse, uuid) from public, anon, authenticated;
revoke execute on function private.andres_titel(int, text) from public, anon, authenticated;
revoke execute on function private.andres_tekst(jsonb) from public, anon, authenticated;
