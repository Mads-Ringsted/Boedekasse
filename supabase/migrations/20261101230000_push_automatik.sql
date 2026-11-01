-- #83 (spec #74 "Push"): payment reminders and automatic-Gebyr pushes.
--
--   betalingspaamindelse  a scheduler step (private.automatik_trin, order 40):
--                         at 10:00 Copenhagen time, a reminder to each active
--                         Medlem who has paid less than they owed, 2 days
--                         before the Betalingsdag, on it and on each late day
--   automatisk_gebyr      a trigger on the feed entry every automatic Gebyr
--                         writes (dos_bonus, catch_up, sen_betaling,
--                         tilbagevendende): one push per Medlem per run or
--                         action, however many Gebyrer it charged
--
-- Additive only: two private tables, functions, a trigger and a step. No
-- function of an earlier migration is redefined; private.push (#81) applies
-- each login's toggle and names the box in the link. A box with default
-- settings gets no reminder (Sen betaling is off) and no automatic Gebyr, so
-- no new push.

-- ---------- Betalingspåmindelse ----------
-- The Betalingsdag belongs to Sen betaling (#80), so a box with Sen betaling
-- off sends no reminders: there is no payment day in force to remind about.
--
-- Due from 10:00 local time on p_dato: the 10:00 run sends, and a later run
-- the same day catches up after a missed one. Nothing in a Pause (no Sæson
-- running at p_nu). Each active Medlem gets at most one reminder per local
-- date, the first kind that applies:
--   for_sen  p_dato is after the Betalingsdag of its month M, and paid(M, p_nu)
--            < owed(M) (private.er_bagud, as Sen betaling uses it)
--   i_dag    p_dato is the Betalingsdag of M, and paid(M, p_nu) < owed(M)
--   snart    p_dato + 2 is the Betalingsdag of its month M' (which may be next
--            month), and paid(M', p_nu) < owed(M'). When M' is next month,
--            owed(M') is the Saldo so far and paid is 0.
-- The text says how much is missing: owed − paid for that month. Late fees of
-- the current month don't count (they are part of next month's owed).
--
-- private.betalingspaamindelse marks a Medlem and date as done, whether or
-- not a push was queued (the toggle is off, or the Medlem has no login), so
-- the hourly runs never send twice and a late toggle-on waits for tomorrow.
create table private.betalingspaamindelse (
  medlem_id   uuid not null references public.medlem on delete cascade,
  dato        date not null,
  slags       text not null check (slags in ('snart', 'i_dag', 'for_sen')),
  mangler     int  not null,
  udbakke_id  bigint references public.push_udbakke on delete set null,
  oprettet    timestamptz not null default now(),
  primary key (medlem_id, dato)
);

create function private.automatik_betalingspaamindelse(
  p_kasse public.bodekasse, p_nu timestamptz, p_dato date)
returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_dag      int := p_kasse.betalingsdag;
  v_m        record;
  v_slags    text;
  v_maaned   date;
  v_mangler  int;
  v_titel    text;
  v_tekst    text;
  v_id       bigint;
begin
  if not p_kasse.sen_betaling_til or p_nu < private.lokal_tid(p_dato, '10:00')
     or private.saeson_paa(p_kasse.id, p_nu) is null then
    return;
  end if;

  for v_m in
    select m.id, m.user_id from public.medlem m
     where m.bodekasse_id = p_kasse.id and (m.udmeldt is null or m.udmeldt > p_nu)
       and not exists (select 1 from private.betalingspaamindelse p
                        where p.medlem_id = m.id and p.dato = p_dato)
     order by m.id
  loop
    continue when not private.medlem_aktiv_paa(v_m.id, p_nu);

    v_slags := case
      when extract(day from p_dato) > v_dag and private.er_bagud(v_m.id, p_dato, p_nu) then 'for_sen'
      when extract(day from p_dato) = v_dag and private.er_bagud(v_m.id, p_dato, p_nu) then 'i_dag'
      when extract(day from p_dato + 2) = v_dag and private.er_bagud(v_m.id, p_dato + 2, p_nu) then 'snart'
    end;
    continue when v_slags is null;

    v_maaned := case when v_slags = 'snart' then p_dato + 2 else p_dato end;
    v_mangler := private.skyldig(v_m.id, v_maaned) - private.betalt(v_m.id, v_maaned, p_nu);

    insert into private.betalingspaamindelse (medlem_id, dato, slags, mangler)
    values (v_m.id, p_dato, v_slags, v_mangler)
    on conflict do nothing;
    continue when not found;

    v_titel := case v_slags
      when 'snart'   then 'Betalingsdag om 2 dage i '
      when 'i_dag'   then 'Betalingsdag i dag i '
      else                'Din betaling er forsinket i ' end || p_kasse.navn;
    v_tekst := 'Du mangler at betale ' || private.kr(v_mangler) || '. ' || case v_slags
      when 'snart'   then 'Betal senest d. ' || v_dag || '.'
      when 'i_dag'   then 'Betal i dag, så undgår du gebyr for sen betaling.'
      else                'Hver dag for sent koster et gebyr.' end;

    v_id := private.push(v_m.user_id, 'betalingspaamindelse', p_kasse.id, v_titel, v_tekst, '/profil');
    if v_id is not null then
      update private.betalingspaamindelse set udbakke_id = v_id
       where medlem_id = v_m.id and dato = p_dato;
    end if;
  end loop;
end $$;

revoke execute on function private.automatik_betalingspaamindelse(public.bodekasse, timestamptz, date)
  from public, anon, authenticated;

-- After every Gebyr step (Catch-up 10, Tilbagevendende 20, Sen betaling 30).
insert into private.automatik_trin (navn, funktion, raekkefoelge)
values ('betalingspaamindelse', 'private.automatik_betalingspaamindelse', 40)
on conflict (navn) do nothing;

-- ---------- Automatisk gebyr ----------
-- Every automatic Gebyr writes one feed entry from the system, for the payer,
-- about the Gebyr (ref gebyr), with data.beloeb:
--   dos_bonus        the Dos-bonus recompute inside giv_boeder, annuller_bode,
--                    the Anke verdicts and fortryd_batch (#77)
--   catch_up         scheduler step 10 (#78)
--   tilbagevendende  scheduler step 20 (#79), data.navn = the rule's name
--   sen_betaling     scheduler step 30 (#80)
-- A trigger on that entry pushes, so no step or RPC is redefined.
--
-- Batching: one push per login, box and statement. A scheduler run is one
-- statement (select private.koer_automatik(now())) and covers every step, so
-- a Catch-up and a Kontingent on the 1st, or three back-charged late days,
-- become one push. An action is one statement too (one RPC call), so a Giv
-- that charges three Dos-bonuses gives one push. The first Gebyr of a
-- statement queues the push; each later one rewrites its title and text.
-- private.push_samling holds the running lines and total. The key is the
-- transaction id plus statement_timestamp(), which is new for every statement
-- the client sends, even inside one transaction (a test's runs stay apart).
--
-- Text: "Nyt gebyr i <box>" or "<n> nye gebyrer i <box>"; then the lines in
-- order of first appearance, with ×n when repeated, and the total:
-- "Catch-up, Kontingent · 75 kr", "Sen betaling ×3 · 75 kr".
-- A Dos-bonus charged by a Giv (gebyr.dos_batch_id) waits out the Fortryd
-- grace like the Bøde push, and links its first feed entry: Fortryd deletes
-- the entries and with them the unsent push. Annulled Gebyrer push nothing.
-- The link opens the payer's own Profil, with the new Saldo.
create table private.push_samling (
  udbakke_id    bigint primary key references public.push_udbakke on delete cascade,
  noegle        text not null,
  user_id       uuid not null,
  bodekasse_id  uuid not null,
  linjer        jsonb not null,   -- [{navn, antal}], in order of first appearance
  antal         int not null,
  beloeb        int not null,
  unique (user_id, bodekasse_id, noegle)
);

create function private.push_automatisk_gebyr() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_noegle text := txid_current() || '@' || statement_timestamp();
  v_login  uuid;
  v_kasse  text;
  v_navn   text;
  v_beloeb int := coalesce((new.data ->> 'beloeb')::int, 0);
  v_batch  uuid;
  v_s      private.push_samling;
  v_linjer jsonb;
  v_id     bigint;
begin
  select user_id into v_login from public.medlem where id = new.modtager_id;
  if v_login is null then return null; end if;
  select navn into v_kasse from public.bodekasse where id = new.bodekasse_id;
  v_navn := case new.art
    when 'dos_bonus'       then 'Dos-bonus'
    when 'catch_up'        then 'Catch-up'
    when 'sen_betaling'    then 'Sen betaling'
    else coalesce(nullif(btrim(new.data ->> 'navn'), ''), 'Tilbagevendende gebyr') end;

  -- Only the current statement's batch is needed; older ones of this login
  -- and box are done.
  delete from private.push_samling
   where user_id = v_login and bodekasse_id = new.bodekasse_id and noegle <> v_noegle;
  select * into v_s from private.push_samling
   where user_id = v_login and bodekasse_id = new.bodekasse_id and noegle = v_noegle;

  if v_s.udbakke_id is null then
    if new.art = 'dos_bonus' then
      select dos_batch_id into v_batch from public.gebyr where id = new.ref_id;
    end if;
    v_linjer := jsonb_build_array(jsonb_build_object('navn', v_navn, 'antal', 1));
    v_id := private.push(
      v_login, 'automatisk_gebyr', new.bodekasse_id,
      private.automatisk_gebyr_titel(1, v_kasse),
      private.automatisk_gebyr_tekst(v_linjer, v_beloeb),
      '/profil',
      case when v_batch is not null then now() + private.fortryd_frist() end,
      new.id);
    if v_id is not null then
      insert into private.push_samling (udbakke_id, noegle, user_id, bodekasse_id, linjer, antal, beloeb)
      values (v_id, v_noegle, v_login, new.bodekasse_id, v_linjer, 1, v_beloeb);
    end if;
    return null;
  end if;

  v_s.antal := v_s.antal + 1;
  v_s.beloeb := v_s.beloeb + v_beloeb;
  v_s.linjer := case
    when exists (select 1 from jsonb_array_elements(v_s.linjer) l where l ->> 'navn' = v_navn)
    then (select jsonb_agg(case when l ->> 'navn' = v_navn
                                then jsonb_set(l, '{antal}', to_jsonb((l ->> 'antal')::int + 1))
                                else l end order by ord)
            from jsonb_array_elements(v_s.linjer) with ordinality as x(l, ord))
    else v_s.linjer || jsonb_build_array(jsonb_build_object('navn', v_navn, 'antal', 1)) end;

  update private.push_samling
     set linjer = v_s.linjer, antal = v_s.antal, beloeb = v_s.beloeb
   where udbakke_id = v_s.udbakke_id;
  update public.push_udbakke
     set titel = private.automatisk_gebyr_titel(v_s.antal, v_kasse),
         tekst = private.automatisk_gebyr_tekst(v_s.linjer, v_s.beloeb)
   where id = v_s.udbakke_id;
  return null;
end $$;

-- "Nyt gebyr i <box>" / "<n> nye gebyrer i <box>".
create function private.automatisk_gebyr_titel(p_antal int, p_kasse text) returns text
language sql immutable set search_path = '' as $$
  select case when p_antal = 1 then 'Nyt gebyr i ' else p_antal || ' nye gebyrer i ' end || p_kasse
$$;

-- "Catch-up, Sen betaling ×2 · 100 kr".
create function private.automatisk_gebyr_tekst(p_linjer jsonb, p_beloeb int) returns text
language sql immutable set search_path = '' as $$
  select string_agg(l ->> 'navn' || case when (l ->> 'antal')::int > 1
                                         then ' ×' || (l ->> 'antal') else '' end,
                    ', ' order by ord)
         || ' · ' || private.kr(p_beloeb)
    from jsonb_array_elements(p_linjer) with ordinality as x(l, ord)
$$;

create trigger push_automatisk_gebyr after insert on public.haendelse
  for each row when (new.art in ('dos_bonus', 'catch_up', 'sen_betaling', 'tilbagevendende'))
  execute function private.push_automatisk_gebyr();
