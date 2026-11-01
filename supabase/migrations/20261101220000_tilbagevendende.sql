-- #79: Tilbagevendende Gebyr. An Admin sets up any number of rules, each
-- with a name, an amount, the Medlemmer it hits and a frequency: weekly on a
-- weekday, or monthly on a day 1-28. The scheduler step 'tilbagevendende'
-- (order 20, after Catch-up) charges each occurrence on its local date.
--
-- 1. Tables: public.tilbagevendende (the rule) and
--    public.tilbagevendende_medlem (rule x Medlem). Read by the box's
--    Medlemmer, written only through the Admin-only RPCs below.
-- 2. gebyr.tilbagevendende_id: the rule a 'tilbagevendende' Gebyr came from.
--    Unique per rule, Medlem and occurrence date (udloeser), annulled rows
--    included, so a second run never charges twice and an annulled
--    occurrence is never charged again.
-- 3. The step only charges today's occurrence (the box's local date at the
--    run), never earlier dates. So a Medlem brought back is never charged for
--    the gap, and a missed hourly run is caught up by the next one that day.
-- 4. "Edits affect only future occurrences": an occurrence on day D uses the
--    rule as it was when D began. A rule created or edited during D first
--    counts from D+1 (aendret < start of D). A stopped rule charges nothing.
-- Additive only: an enum, two tables, a column, a check, an index, functions.

-- ---------- The rule ----------
create type public.tilbagevendende_frekvens as enum ('uge', 'maaned');

-- dag: for 'uge' the ISO weekday (1 = mandag ... 7 = søndag); for 'maaned'
-- the day of the month, 1-28.
-- aendret: when it was created or last edited. An occurrence on day D only
-- happens if aendret is before the start of D (Europe/Copenhagen).
create table public.tilbagevendende (
  id            uuid primary key default gen_random_uuid(),
  bodekasse_id  uuid not null references public.bodekasse on delete cascade,
  navn          text not null check (btrim(navn) <> ''),
  beloeb        int  not null check (beloeb > 0),
  frekvens      public.tilbagevendende_frekvens not null,
  dag           int  not null,
  oprettet      timestamptz not null default now(),
  oprettet_af   uuid not null,
  aendret       timestamptz not null default now(),
  stoppet       timestamptz,
  stoppet_af    uuid,
  check (case frekvens when 'uge' then dag between 1 and 7 else dag between 1 and 28 end),
  check ((stoppet is null) = (stoppet_af is null)),
  unique (bodekasse_id, id),
  foreign key (bodekasse_id, oprettet_af) references public.medlem (bodekasse_id, id),
  foreign key (bodekasse_id, stoppet_af)  references public.medlem (bodekasse_id, id)
);

-- The Medlemmer a rule hits. An Udmeldt Medlem may stay listed; the step
-- skips them until they are brought back. Deleting a Medlem (slet_medlem)
-- takes them off every rule.
create table public.tilbagevendende_medlem (
  bodekasse_id        uuid not null,
  tilbagevendende_id  uuid not null,
  medlem_id           uuid not null,
  primary key (tilbagevendende_id, medlem_id),
  foreign key (bodekasse_id, tilbagevendende_id)
    references public.tilbagevendende (bodekasse_id, id) on delete cascade,
  foreign key (bodekasse_id, medlem_id)
    references public.medlem (bodekasse_id, id) on delete cascade
);

alter table public.tilbagevendende enable row level security;
alter table public.tilbagevendende_medlem enable row level security;
create policy laes on public.tilbagevendende for select to authenticated
  using (bodekasse_id in (select private.mine_bodekasser()));
create policy laes on public.tilbagevendende_medlem for select to authenticated
  using (bodekasse_id in (select private.mine_bodekasser()));
grant select on public.tilbagevendende, public.tilbagevendende_medlem to authenticated;

-- ---------- The Gebyr ----------
alter table public.gebyr add column if not exists tilbagevendende_id uuid;
alter table public.gebyr add constraint gebyr_tilbagevendende_fkey
  foreign key (bodekasse_id, tilbagevendende_id) references public.tilbagevendende (bodekasse_id, id);
-- A 'tilbagevendende' Gebyr names its rule and occurrence date and no other
-- cause; no other kind names a rule.
alter table public.gebyr add constraint gebyr_tilbagevendende_check check (
  case when art = 'tilbagevendende'
       then tilbagevendende_id is not null and udloeser is not null
            and num_nonnulls(bodekategori_id, bode_id, anke_id, frikob_id, konkurrence_id) = 0
       else tilbagevendende_id is null
  end);
create unique index if not exists gebyr_tilbagevendende_unik
  on public.gebyr (tilbagevendende_id, medlem_id, udloeser) where art = 'tilbagevendende';

-- ---------- Shared checks for create and edit ----------
-- Checks the fields and returns the trimmed name. The Medlemmer must all be
-- in the box (Udmeldte allowed), at least one.
-- Errors: navn_mangler, beloeb_ugyldig, frekvens_ugyldig, medlemmer_mangler,
-- medlem_ukendt.
create function private.tjek_tilbagevendende(
  p_bodekasse uuid, p_navn text, p_beloeb int,
  p_frekvens public.tilbagevendende_frekvens, p_dag int, p_medlemmer uuid[])
returns text
language plpgsql stable security definer set search_path = '' as $$
declare v_navn text := btrim(coalesce(p_navn, ''));
begin
  if v_navn = '' then raise exception 'navn_mangler'; end if;
  if p_beloeb is null or p_beloeb <= 0 then raise exception 'beloeb_ugyldig'; end if;
  if p_frekvens is null or p_dag is null
     or (p_frekvens = 'uge' and p_dag not between 1 and 7)
     or (p_frekvens = 'maaned' and p_dag not between 1 and 28) then
    raise exception 'frekvens_ugyldig';
  end if;
  if coalesce(cardinality(p_medlemmer), 0) = 0 then raise exception 'medlemmer_mangler'; end if;
  if exists (select 1 from unnest(p_medlemmer) u(id)
              where u.id is null
                 or not exists (select 1 from public.medlem m
                                 where m.id = u.id and m.bodekasse_id = p_bodekasse)) then
    raise exception 'medlem_ukendt';
  end if;
  return v_navn;
end $$;

-- ---------- opret_tilbagevendende ----------
-- Admin only. The first occurrence is the first matching day after today.
-- No feed entry; each charge gets one. Returns {"tilbagevendende_id": uuid}.
-- Errors: ikke_medlem / ikke_admin (42501), and those of tjek_tilbagevendende.
create function public.opret_tilbagevendende(
  p_klient_id uuid, p_bodekasse uuid, p_navn text, p_beloeb int,
  p_frekvens public.tilbagevendende_frekvens, p_dag int, p_medlemmer uuid[])
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_mig       uuid := private.mit_admin(p_bodekasse);
  v_tidligere jsonb;
  v_navn      text;
  v_id        uuid;
begin
  v_tidligere := private.start_kald(p_klient_id, 'opret_tilbagevendende');
  if v_tidligere is not null then return v_tidligere; end if;
  v_navn := private.tjek_tilbagevendende(p_bodekasse, p_navn, p_beloeb, p_frekvens, p_dag, p_medlemmer);

  insert into public.tilbagevendende (bodekasse_id, navn, beloeb, frekvens, dag, oprettet_af)
  values (p_bodekasse, v_navn, p_beloeb, p_frekvens, p_dag, v_mig)
  returning id into v_id;
  insert into public.tilbagevendende_medlem (bodekasse_id, tilbagevendende_id, medlem_id)
  select distinct p_bodekasse, v_id, u.id from unnest(p_medlemmer) u(id);

  return private.afslut_kald(p_klient_id, jsonb_build_object('tilbagevendende_id', v_id));
end $$;

revoke execute on function public.opret_tilbagevendende(uuid, uuid, text, int, public.tilbagevendende_frekvens, int, uuid[]) from public, anon;
grant execute on function public.opret_tilbagevendende(uuid, uuid, text, int, public.tilbagevendende_frekvens, int, uuid[]) to authenticated;

-- Locks a rule and checks the caller is an Admin of its box. Returns the
-- row. Errors: ikke_fundet, ikke_medlem / ikke_admin (42501).
create function private.min_tilbagevendende(p_tilbagevendende uuid) returns public.tilbagevendende
language plpgsql volatile security definer set search_path = '' as $$
declare v_regel public.tilbagevendende;
begin
  select * into v_regel from public.tilbagevendende where id = p_tilbagevendende for update;
  if v_regel.id is null then raise exception 'ikke_fundet'; end if;
  perform private.mit_admin(v_regel.bodekasse_id);
  return v_regel;
end $$;

-- ---------- ret_tilbagevendende ----------
-- Admin only. Replaces the name, amount, frequency and Medlemmer. Gebyrer
-- already charged keep their amount; the edit counts from the next day's
-- occurrences on (aendret). No feed entry. Returns {}.
-- Errors: ikke_fundet, ikke_medlem / ikke_admin (42501),
-- tilbagevendende_stoppet, and those of tjek_tilbagevendende.
create function public.ret_tilbagevendende(
  p_klient_id uuid, p_tilbagevendende uuid, p_navn text, p_beloeb int,
  p_frekvens public.tilbagevendende_frekvens, p_dag int, p_medlemmer uuid[])
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_regel     public.tilbagevendende := private.min_tilbagevendende(p_tilbagevendende);
  v_tidligere jsonb;
  v_navn      text;
begin
  v_tidligere := private.start_kald(p_klient_id, 'ret_tilbagevendende');
  if v_tidligere is not null then return v_tidligere; end if;

  if v_regel.stoppet is not null then raise exception 'tilbagevendende_stoppet'; end if;
  v_navn := private.tjek_tilbagevendende(v_regel.bodekasse_id, p_navn, p_beloeb, p_frekvens, p_dag, p_medlemmer);

  update public.tilbagevendende
     set navn = v_navn, beloeb = p_beloeb, frekvens = p_frekvens, dag = p_dag, aendret = now()
   where id = v_regel.id;
  delete from public.tilbagevendende_medlem
   where tilbagevendende_id = v_regel.id and medlem_id <> all (p_medlemmer);
  insert into public.tilbagevendende_medlem (bodekasse_id, tilbagevendende_id, medlem_id)
  select distinct v_regel.bodekasse_id, v_regel.id, u.id from unnest(p_medlemmer) u(id)
  on conflict do nothing;

  return private.afslut_kald(p_klient_id, '{}');
end $$;

revoke execute on function public.ret_tilbagevendende(uuid, uuid, text, int, public.tilbagevendende_frekvens, int, uuid[]) from public, anon;
grant execute on function public.ret_tilbagevendende(uuid, uuid, text, int, public.tilbagevendende_frekvens, int, uuid[]) to authenticated;

-- ---------- stop_tilbagevendende ----------
-- Admin only. A stopped rule charges nothing more and can't be edited;
-- what it charged stays (annul single Gebyrer with annuller_gebyr).
-- Stopping a stopped rule changes nothing. No feed entry. Returns {}.
-- Errors: ikke_fundet, ikke_medlem / ikke_admin (42501).
create function public.stop_tilbagevendende(p_klient_id uuid, p_tilbagevendende uuid)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_regel     public.tilbagevendende := private.min_tilbagevendende(p_tilbagevendende);
  v_mig       uuid := private.mit_admin(v_regel.bodekasse_id);
  v_tidligere jsonb;
begin
  v_tidligere := private.start_kald(p_klient_id, 'stop_tilbagevendende');
  if v_tidligere is not null then return v_tidligere; end if;

  if v_regel.stoppet is null then
    update public.tilbagevendende set stoppet = now(), stoppet_af = v_mig where id = v_regel.id;
  end if;
  return private.afslut_kald(p_klient_id, '{}');
end $$;

revoke execute on function public.stop_tilbagevendende(uuid, uuid) from public, anon;
grant execute on function public.stop_tilbagevendende(uuid, uuid) to authenticated;

-- ---------- annuller_gebyr (from 20261101200000_sen_betaling.sql) ----------
-- As before (Sen betaling: Admin or Kasserer; the rest: Admin), plus: an
-- Admin can annul one occurrence of a Tilbagevendende Gebyr. Its unique index keeps the annulled row, so the automation never
-- charges that rule, Medlem and date again. The feed entry's `navn` is the
-- rule's name.
create or replace function public.annuller_gebyr(
  p_klient_id uuid, p_gebyr uuid, p_note text default null)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_note      text := nullif(btrim(p_note), '');
  v_gebyr     public.gebyr;
  v_mig       uuid;
  v_navn      text;
  v_tidligere jsonb;
begin
  select * into v_gebyr from public.gebyr where id = p_gebyr for update;
  if v_gebyr.id is null then raise exception 'ikke_fundet'; end if;
  if v_gebyr.art = 'sen_betaling' then
    v_mig := private.mine_penge(v_gebyr.bodekasse_id);
  else
    v_mig := private.mit_admin(v_gebyr.bodekasse_id);
  end if;
  v_tidligere := private.start_kald(p_klient_id, 'annuller_gebyr');
  if v_tidligere is not null then return v_tidligere; end if;

  if v_gebyr.art not in ('oprettelse', 'anke', 'catch_up', 'sen_betaling', 'tilbagevendende') then
    raise exception 'kan_ikke_annulleres';
  end if;
  if v_gebyr.annulleret is not null then raise exception 'allerede_annulleret'; end if;
  perform private.tjek_seneste_saeson(v_gebyr.bodekasse_id, v_gebyr.saeson_id);

  update public.gebyr
     set annulleret = now(), annulleret_af = v_mig, annulleret_note = v_note
   where id = v_gebyr.id;

  if v_gebyr.art = 'oprettelse' then
    select navn into v_navn from public.bodekategori where id = v_gebyr.bodekategori_id;
  elsif v_gebyr.art = 'anke' then
    select coalesce(k.navn, b.grund) into v_navn
      from public.anke a
      join public.bode b on b.id = a.bode_id
      left join public.bodekategori k on k.id = b.bodekategori_id
     where a.id = v_gebyr.anke_id;
  elsif v_gebyr.art = 'tilbagevendende' then
    select navn into v_navn from public.tilbagevendende where id = v_gebyr.tilbagevendende_id;
  end if;

  perform private.tilfoej_haendelse(
    v_gebyr.bodekasse_id, v_mig, 'gebyr_annulleret',
    jsonb_build_object('gebyr_id', v_gebyr.id, 'art', v_gebyr.art, 'navn', v_navn,
                       'beloeb', v_gebyr.beloeb, 'note', v_note),
    p_modtager => v_gebyr.medlem_id, p_saeson => v_gebyr.saeson_id);

  return private.afslut_kald(p_klient_id, jsonb_build_object('gebyr_id', v_gebyr.id));
end $$;

-- ---------- The scheduler step ----------
-- For each rule of the box that is not stopped, was last changed before the
-- start of p_dato, and falls on p_dato (weekday or day of month): when a
-- Sæson runs at the start of p_dato (same rule as Catch-up), each listed
-- Medlem who is active at p_nu pays the rule's amount. The Gebyr is dated to
-- the start of p_dato, udloeser = p_dato. Each new charge gets a feed entry
-- 'tilbagevendende' {navn, beloeb, dato} from the system (no aktoer), about
-- the Gebyr (ref gebyr), for the payer.
create function private.automatik_tilbagevendende(
  p_kasse public.bodekasse, p_nu timestamptz, p_dato date)
returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_start  timestamptz := private.lokal_tid(p_dato);
  v_saeson uuid := private.saeson_paa(p_kasse.id, v_start);
  v_regel  public.tilbagevendende;
  v_medlem uuid;
  v_id     uuid;
begin
  if v_saeson is null then return; end if;

  for v_regel in
    select * from public.tilbagevendende r
     where r.bodekasse_id = p_kasse.id and r.stoppet is null and r.aendret < v_start
       and r.dag = case r.frekvens when 'uge' then extract(isodow from p_dato)::int
                                   else extract(day from p_dato)::int end
     order by r.oprettet, r.id
  loop
    for v_medlem in
      select m.id from public.tilbagevendende_medlem tm
        join public.medlem m on m.id = tm.medlem_id
       where tm.tilbagevendende_id = v_regel.id
         and (m.udmeldt is null or m.udmeldt > p_nu)
       order by m.id
    loop
      insert into public.gebyr (bodekasse_id, saeson_id, medlem_id, art, beloeb,
                                tilbagevendende_id, udloeser, oprettet)
      values (p_kasse.id, v_saeson, v_medlem, 'tilbagevendende', v_regel.beloeb,
              v_regel.id, p_dato, v_start)
      on conflict do nothing
      returning id into v_id;

      if v_id is not null then
        perform private.tilfoej_haendelse(
          p_kasse.id, null, 'tilbagevendende',
          jsonb_build_object('navn', v_regel.navn, 'beloeb', v_regel.beloeb, 'dato', p_dato),
          'gebyr', v_id, p_modtager => v_medlem, p_saeson => v_saeson);
      end if;
    end loop;
  end loop;
end $$;

insert into private.automatik_trin (navn, funktion, raekkefoelge)
values ('tilbagevendende', 'private.automatik_tilbagevendende', 20)
on conflict (navn) do nothing;
