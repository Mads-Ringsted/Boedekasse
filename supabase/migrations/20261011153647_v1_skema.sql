-- =====================================================================
-- Bødekasse v1 schema (#47). Built from the data model decision (#40).
--
-- Principles:
-- 1. Every tenant table has bodekasse_id. Links between tenant rows are
--    composite FKs (bodekasse_id, x_id), so cross-box links are impossible.
-- 2. Reads: RLS select policy "bodekasse_id in (select private.mine_bodekasser())"
--    on every table. Udmeldte Medlemmer are excluded from mine_bodekasser().
-- 3. Writes: only through public RPCs (security definer, search_path = '').
--    `authenticated` has NO insert/update/delete grant on any table.
-- 4. Saldo, Kassen and per-Sæson figures are views (security_invoker), never stored.
-- 5. Nothing is deleted except a Fortryd batch. Corrections set annulleret_*.
-- 6. Amounts are whole kroner: int > 0 (a placement Gebyr may be 0).
-- =====================================================================

create schema if not exists private;
revoke all on schema private from public;

-- ---------- Box and people ----------

create table public.bodekasse (
  id                   uuid primary key default gen_random_uuid(),
  navn                 text not null check (btrim(navn) <> ''),
  mobilepay_box        text,
  -- Settings. Defaults = a new box: every special rule off except the Engangsbøde Gebyr.
  oprettelsesgebyr_til boolean not null default false,
  oprettelsesgebyr     int     not null default 25  check (oprettelsesgebyr > 0),
  engangsgebyr_til     boolean not null default true,
  engangsgebyr         int     not null default 10  check (engangsgebyr > 0),
  anke_til             boolean not null default false,
  anke_vindue_timer    int     not null default 24  check (anke_vindue_timer > 0),
  anke_min             int     not null default 1   check (anke_min > 0),
  anke_max_gange       numeric not null default 2   check (anke_max_gange >= 1),
  frikob_til           boolean not null default false,
  frikob_pris          int     not null default 300 check (frikob_pris > 0),
  konkurrence_til      boolean not null default false,
  placeringer          int[]   not null default '{0,10,25,35,40,45,50}'
                       check (cardinality(placeringer) > 0 and 0 <= all (placeringer)),
  fravaersgebyr        int     not null default 50  check (fravaersgebyr > 0),
  oprettet             timestamptz not null default now()
);
-- Room for a later push_subscription table (out of scope for v1).

-- The join code sits in its own table so only Admins can read it (RLS below).
create table public.bodekasse_kode (
  bodekasse_id  uuid primary key references public.bodekasse on delete cascade,
  kode          text not null unique check (kode ~ '^[A-Z0-9]{6}$')   -- e.g. K7P2QX
);

create table public.medlem (
  id            uuid primary key default gen_random_uuid(),
  bodekasse_id  uuid not null references public.bodekasse on delete cascade,
  navn          text not null check (btrim(navn) <> ''),
  email         text check (email = lower(email)),   -- null when joined by code
  user_id       uuid references auth.users on delete set null,
  er_admin      boolean not null default false,
  udmeldt       timestamptz,                          -- null = active
  oprettet      timestamptz not null default now(),
  unique (bodekasse_id, id),
  unique (bodekasse_id, email),
  unique (bodekasse_id, user_id)
);
create index medlem_user_id_idx on public.medlem (user_id);
create index medlem_uklaimet_email_idx on public.medlem (email) where user_id is null;

create table public.saeson (
  id            uuid primary key default gen_random_uuid(),
  bodekasse_id  uuid not null references public.bodekasse on delete cascade,
  loebenr       bigint generated always as identity,  -- creation order; latest = highest
  navn          text not null check (btrim(navn) <> ''),
  startet       timestamptz not null default now(),
  slutdato      date,          -- planned; the Sæson ends at Copenhagen midnight after it
  afsluttet     timestamptz,   -- "Afslut sæson nu" / "Start ny sæson"
  unique (bodekasse_id, id)
);
create index saeson_bodekasse_idx on public.saeson (bodekasse_id, loebenr desc);

-- ---------- Charges ----------

create type public.gebyr_art as enum
  ('oprettelse', 'engangsbode', 'anke', 'frikob', 'placering', 'fravaer');
create type public.anke_afgoerelse as enum ('modtager_vandt', 'giver_vandt', 'ikke_afgjort');
create type public.melding_status as enum ('afventer', 'bekraeftet', 'afvist', 'trukket');

create table public.bodekategori (
  id            uuid primary key default gen_random_uuid(),
  bodekasse_id  uuid not null references public.bodekasse on delete cascade,
  navn          text not null check (btrim(navn) <> ''),
  pris          int  not null check (pris > 0),
  beskrivelse   text,
  arkiveret     timestamptz,
  oprettet_af   uuid not null,
  oprettet      timestamptz not null default now(),
  unique (bodekasse_id, id),
  foreign key (bodekasse_id, oprettet_af) references public.medlem (bodekasse_id, id)
);
-- A name is unique among active Bødekategorier; an archived name is free to reuse.
create unique index bodekategori_aktivt_navn_idx
  on public.bodekategori (bodekasse_id, lower(navn)) where arkiveret is null;

create table public.bode (
  id               uuid primary key default gen_random_uuid(),
  bodekasse_id     uuid not null references public.bodekasse on delete cascade,
  saeson_id        uuid not null,
  batch_id         uuid not null,                    -- one Giv bøder submit
  giver_id         uuid not null,
  modtager_id      uuid not null,
  bodekategori_id  uuid,                             -- null = Engangsbøde
  grund            text,                             -- Engangsbøde reason
  pris             int  not null check (pris > 0),   -- kept price
  givet            timestamptz not null default now(),
  annulleret       timestamptz,
  annulleret_af    uuid,
  annulleret_note  text,
  check ((bodekategori_id is null) = (grund is not null)),
  check (grund is null or btrim(grund) <> ''),
  check ((annulleret is null) = (annulleret_af is null)),
  unique (bodekasse_id, id),
  foreign key (bodekasse_id, saeson_id)       references public.saeson (bodekasse_id, id),
  foreign key (bodekasse_id, giver_id)        references public.medlem (bodekasse_id, id),
  foreign key (bodekasse_id, modtager_id)     references public.medlem (bodekasse_id, id),
  foreign key (bodekasse_id, bodekategori_id) references public.bodekategori (bodekasse_id, id),
  foreign key (bodekasse_id, annulleret_af)   references public.medlem (bodekasse_id, id)
);
create index bode_saeson_idx on public.bode (bodekasse_id, saeson_id);
create index bode_batch_idx on public.bode (batch_id);

create table public.anke (
  id            uuid primary key default gen_random_uuid(),
  bodekasse_id  uuid not null references public.bodekasse on delete cascade,
  saeson_id     uuid not null,
  bode_id       uuid not null unique,                -- one Anke per Bøde, ever
  indgivet      timestamptz not null default now(),
  afgoerelse    public.anke_afgoerelse,              -- null = pending
  afgjort_af    uuid,
  afgjort       timestamptz,
  aendret       boolean not null default false,      -- "Afgørelse ændret"
  unique (bodekasse_id, id),
  foreign key (bodekasse_id, saeson_id)  references public.saeson (bodekasse_id, id),
  foreign key (bodekasse_id, bode_id)    references public.bode (bodekasse_id, id),
  foreign key (bodekasse_id, afgjort_af) references public.medlem (bodekasse_id, id)
);

create table public.frikob (
  id               uuid primary key default gen_random_uuid(),
  bodekasse_id     uuid not null references public.bodekasse on delete cascade,
  saeson_id        uuid not null,
  medlem_id        uuid not null,                    -- who is covered
  bodekategori_id  uuid not null,                    -- the price paid is its Gebyr
  koebt           timestamptz not null default now(),
  registreret_af   uuid not null,                    -- the Medlem, or an Admin for them
  annulleret       timestamptz,
  annulleret_af    uuid,
  annulleret_note  text,
  check ((annulleret is null) = (annulleret_af is null)),
  unique (bodekasse_id, id),
  foreign key (bodekasse_id, saeson_id)       references public.saeson (bodekasse_id, id),
  foreign key (bodekasse_id, medlem_id)       references public.medlem (bodekasse_id, id),
  foreign key (bodekasse_id, bodekategori_id) references public.bodekategori (bodekasse_id, id),
  foreign key (bodekasse_id, registreret_af)  references public.medlem (bodekasse_id, id),
  foreign key (bodekasse_id, annulleret_af)   references public.medlem (bodekasse_id, id)
);
-- One Frikøb per Bødekategori per Medlem per Sæson.
create unique index frikob_en_pr_saeson_idx
  on public.frikob (saeson_id, medlem_id, bodekategori_id) where annulleret is null;

create table public.konkurrence (
  id               uuid primary key default gen_random_uuid(),
  bodekasse_id     uuid not null references public.bodekasse on delete cascade,
  saeson_id        uuid not null,
  titel            text not null check (btrim(titel) <> ''),
  dato             date not null default (now() at time zone 'Europe/Copenhagen')::date,
  oprettet_af      uuid not null,
  oprettet         timestamptz not null default now(),
  rettet_af        uuid,
  rettet           timestamptz,
  annulleret       timestamptz,
  annulleret_af    uuid,
  annulleret_note  text,
  check ((annulleret is null) = (annulleret_af is null)),
  unique (bodekasse_id, id),
  foreign key (bodekasse_id, saeson_id)     references public.saeson (bodekasse_id, id),
  foreign key (bodekasse_id, oprettet_af)   references public.medlem (bodekasse_id, id),
  foreign key (bodekasse_id, rettet_af)     references public.medlem (bodekasse_id, id),
  foreign key (bodekasse_id, annulleret_af) references public.medlem (bodekasse_id, id)
);

-- The current finishing order; replaced wholesale on correction.
create table public.konkurrence_resultat (
  bodekasse_id    uuid not null references public.bodekasse on delete cascade,
  konkurrence_id  uuid not null,
  medlem_id       uuid not null,
  plads           int check (plads > 0),             -- null = fraværende
  primary key (konkurrence_id, medlem_id),
  foreign key (bodekasse_id, konkurrence_id) references public.konkurrence (bodekasse_id, id),
  foreign key (bodekasse_id, medlem_id)      references public.medlem (bodekasse_id, id)
);

create table public.gebyr (
  id               uuid primary key default gen_random_uuid(),
  bodekasse_id     uuid not null references public.bodekasse on delete cascade,
  saeson_id        uuid not null,
  medlem_id        uuid not null,                    -- who pays
  art              public.gebyr_art not null,
  beloeb           int  not null check (beloeb >= 0),
  -- exactly one cause, matching art:
  bodekategori_id  uuid,   -- oprettelse
  bode_id          uuid,   -- engangsbode
  anke_id          uuid,   -- anke
  frikob_id        uuid,   -- frikob
  konkurrence_id   uuid,   -- placering / fravaer
  oprettet         timestamptz not null default now(),
  annulleret       timestamptz,
  annulleret_af    uuid,
  annulleret_note  text,
  check (num_nonnulls(bodekategori_id, bode_id, anke_id, frikob_id, konkurrence_id) = 1),
  check (case art
           when 'oprettelse'  then bodekategori_id is not null
           when 'engangsbode' then bode_id is not null
           when 'anke'        then anke_id is not null
           when 'frikob'      then frikob_id is not null
           else                    konkurrence_id is not null
         end),
  check (beloeb > 0 or art = 'placering'),           -- only a placement Gebyr may be 0
  check ((annulleret is null) = (annulleret_af is null)),
  unique (bodekasse_id, id),
  foreign key (bodekasse_id, saeson_id)       references public.saeson (bodekasse_id, id),
  foreign key (bodekasse_id, medlem_id)       references public.medlem (bodekasse_id, id),
  foreign key (bodekasse_id, bodekategori_id) references public.bodekategori (bodekasse_id, id),
  foreign key (bodekasse_id, bode_id)         references public.bode (bodekasse_id, id),
  foreign key (bodekasse_id, anke_id)         references public.anke (bodekasse_id, id),
  foreign key (bodekasse_id, frikob_id)       references public.frikob (bodekasse_id, id),
  foreign key (bodekasse_id, konkurrence_id)  references public.konkurrence (bodekasse_id, id),
  foreign key (bodekasse_id, annulleret_af)   references public.medlem (bodekasse_id, id)
);
create index gebyr_medlem_idx on public.gebyr (medlem_id);
create index gebyr_saeson_idx on public.gebyr (bodekasse_id, saeson_id);

-- ---------- Money ----------

create table public.betalingsmelding (
  id             uuid primary key default gen_random_uuid(),
  bodekasse_id   uuid not null references public.bodekasse on delete cascade,
  saeson_id      uuid not null,                      -- latest Sæson, Pause included
  medlem_id      uuid not null,                      -- the reporter
  beloeb         int  not null check (beloeb > 0),
  status         public.melding_status not null default 'afventer',
  meldt          timestamptz not null default now(),
  behandlet_af   uuid,
  behandlet      timestamptz,
  unique (bodekasse_id, id),
  foreign key (bodekasse_id, saeson_id)    references public.saeson (bodekasse_id, id),
  foreign key (bodekasse_id, medlem_id)    references public.medlem (bodekasse_id, id),
  foreign key (bodekasse_id, behandlet_af) references public.medlem (bodekasse_id, id)
);

create table public.indbetaling (
  id                   uuid primary key default gen_random_uuid(),
  bodekasse_id         uuid not null references public.bodekasse on delete cascade,
  saeson_id            uuid not null,                -- latest Sæson, Pause included
  medlem_id            uuid not null,                -- who paid
  beloeb               int  not null check (beloeb > 0),
  note                 text,
  registreret_af       uuid not null,                -- an Admin, or the confirmer
  betalingsmelding_id  uuid unique,                  -- set when a melding was confirmed
  registreret          timestamptz not null default now(),
  annulleret           timestamptz,
  annulleret_af        uuid,
  annulleret_note      text,
  check ((annulleret is null) = (annulleret_af is null)),
  unique (bodekasse_id, id),
  foreign key (bodekasse_id, saeson_id)           references public.saeson (bodekasse_id, id),
  foreign key (bodekasse_id, medlem_id)           references public.medlem (bodekasse_id, id),
  foreign key (bodekasse_id, registreret_af)      references public.medlem (bodekasse_id, id),
  foreign key (bodekasse_id, betalingsmelding_id) references public.betalingsmelding (bodekasse_id, id),
  foreign key (bodekasse_id, annulleret_af)       references public.medlem (bodekasse_id, id)
);
create index indbetaling_medlem_idx on public.indbetaling (medlem_id);

create table public.haevning (
  id               uuid primary key default gen_random_uuid(),
  bodekasse_id     uuid not null references public.bodekasse on delete cascade,
  saeson_id        uuid not null,                    -- latest Sæson, Pause included
  beloeb           int  not null check (beloeb > 0),
  formaal          text not null check (btrim(formaal) <> ''),
  registreret_af   uuid not null,
  registreret      timestamptz not null default now(),
  annulleret       timestamptz,
  annulleret_af    uuid,
  annulleret_note  text,
  check ((annulleret is null) = (annulleret_af is null)),
  unique (bodekasse_id, id),
  foreign key (bodekasse_id, saeson_id)      references public.saeson (bodekasse_id, id),
  foreign key (bodekasse_id, registreret_af) references public.medlem (bodekasse_id, id),
  foreign key (bodekasse_id, annulleret_af)  references public.medlem (bodekasse_id, id)
);

-- ---------- Activity feed (append-only) ----------

create table public.haendelse (
  id            bigint generated always as identity primary key,
  bodekasse_id  uuid not null references public.bodekasse on delete cascade,
  saeson_id     uuid not null,
  tid           timestamptz not null default now(),
  aktoer_id     uuid,                     -- null for the system
  art           text not null,            -- 'bode_givet', 'annulleret', ...
  batch_id      uuid,                     -- a Giv batch is one row per receiver:
  modtager_id   uuid,                     --   grouped by (batch_id, modtager_id)
  ref_tabel     text,                     -- the row it is about, for strike-through
  ref_id        uuid,
  data          jsonb not null default '{}',   -- snapshot bits (names, amounts)
  foreign key (bodekasse_id, saeson_id)   references public.saeson (bodekasse_id, id),
  foreign key (bodekasse_id, aktoer_id)   references public.medlem (bodekasse_id, id),
  foreign key (bodekasse_id, modtager_id) references public.medlem (bodekasse_id, id)
);
create index haendelse_feed_idx on public.haendelse (bodekasse_id, saeson_id, tid desc);
create index haendelse_ref_idx on public.haendelse (ref_id);

-- ---------- Access helpers (private schema is not exposed by the API) ----------

-- The Bødekasser the caller is an active (not Udmeldt) Medlem of.
create function private.mine_bodekasser() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select bodekasse_id from public.medlem
   where user_id = (select auth.uid()) and udmeldt is null
$$;

-- The Bødekasser the caller is an active Admin of.
create function private.admin_bodekasser() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select bodekasse_id from public.medlem
   where user_id = (select auth.uid()) and udmeldt is null and er_admin
$$;

-- ---------- Claiming a spot ----------
-- A pre-added Medlem (name + email) is linked to the login with that email
-- once the email is confirmed. Keep these tiny: if the auth.users trigger
-- fails, every sign-up fails.

-- A: a login's email is confirmed (first OTP verify) -> claim in every box.
create function private.claim_ved_bekraeftelse() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.medlem m
     set user_id = new.id
   where m.email = lower(new.email)
     and m.user_id is null
     -- someone who already has a spot in that box (joined by code) keeps it
     and not exists (select 1 from public.medlem x
                      where x.bodekasse_id = m.bodekasse_id and x.user_id = new.id);
  return new;
end $$;

create trigger claim_medlem_ved_bekraeftelse
  after insert or update of email_confirmed_at on auth.users
  for each row when (new.email_confirmed_at is not null and new.email is not null)
  execute function private.claim_ved_bekraeftelse();

-- B: a Medlem is added (or its email fixed before claim) -> claim at once if a
-- confirmed login with that email exists.
create function private.claim_ved_medlem() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.email := lower(nullif(btrim(new.email), ''));
  if new.user_id is null and new.email is not null then
    select u.id into new.user_id
      from auth.users u
     where lower(u.email) = new.email
       and u.email_confirmed_at is not null
       and not exists (select 1 from public.medlem x
                       where x.bodekasse_id = new.bodekasse_id and x.user_id = u.id)
     limit 1;
  end if;
  return new;
end $$;

create trigger claim_medlem_ved_indsaet
  before insert or update of email on public.medlem
  for each row execute function private.claim_ved_medlem();

-- A fresh, unused join code: 6 characters, no look-alikes (0/O, 1/I/L).
create function private.ny_join_kode() returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_tegn constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_kode text;
begin
  loop
    select string_agg(substr(v_tegn, 1 + floor(random() * length(v_tegn))::int, 1), '')
      into v_kode from generate_series(1, 6);
    exit when not exists (select 1 from public.bodekasse_kode where kode = v_kode);
  end loop;
  return v_kode;
end $$;

-- ---------- Derived views (security_invoker: the caller's RLS applies) ----------

-- Every Sæson with when it ends and whether it is running. Computed at read
-- time; no cron. Only the latest Sæson of a box can run.
create view public.saeson_status with (security_invoker = true) as
select s.*,
       least(s.afsluttet,
             (s.slutdato + 1)::timestamp at time zone 'Europe/Copenhagen') as slutter,
       s.loebenr = max(s.loebenr) over (partition by s.bodekasse_id)      as er_seneste,
       s.loebenr = max(s.loebenr) over (partition by s.bodekasse_id)
         and now() < coalesce(least(s.afsluttet,
                                    (s.slutdato + 1)::timestamp at time zone 'Europe/Copenhagen'),
                              'infinity')                                 as koerer
  from public.saeson s;

-- Per box: the latest Sæson, the running one (null in a Pause), and Pause.
create view public.bodekasse_saeson with (security_invoker = true) as
select b.id                                    as bodekasse_id,
       s.id                                    as seneste_saeson_id,
       case when s.koerer then s.id end        as aktiv_saeson_id,
       not coalesce(s.koerer, false)           as pause
  from public.bodekasse b
  left join public.saeson_status s on s.bodekasse_id = b.id and s.er_seneste;

-- Every Bøde with who bears it, from its Anke: no Anke -> receiver;
-- pending -> nobody (anket); modtager_vandt -> giver; giver_vandt or
-- ikke_afgjort -> receiver. Annulled -> nobody.
create view public.bode_baerer with (security_invoker = true) as
select b.*,
       a.id                                          as anke_id,
       a.afgoerelse,
       b.annulleret is null and a.id is not null and a.afgoerelse is null as anket,
       case
         when b.annulleret is not null       then null
         when a.id is null                   then b.modtager_id
         when a.afgoerelse is null           then null
         when a.afgoerelse = 'modtager_vandt' then b.giver_id
         else b.modtager_id
       end                                           as baerer_id
  from public.bode b
  left join public.anke a on a.bode_id = b.id;

-- Saldo per Medlem = Bøder they bear + Gebyrer - Indbetalinger, not annulled,
-- across all Sæsoner. Negative = "Til gode". Frikøb never enters it.
create view public.medlem_saldo with (security_invoker = true) as
select m.bodekasse_id,
       m.id as medlem_id,
       ( coalesce((select sum(b.pris)   from public.bode_baerer b where b.baerer_id = m.id), 0)
       + coalesce((select sum(g.beloeb) from public.gebyr g
                    where g.medlem_id = m.id and g.annulleret is null), 0)
       - coalesce((select sum(i.beloeb) from public.indbetaling i
                    where i.medlem_id = m.id and i.annulleret is null), 0)
       )::int as saldo
  from public.medlem m;

-- Kassen per box = Indbetalinger - Hævninger, not annulled, across all Sæsoner.
create view public.kassen with (security_invoker = true) as
select k.bodekasse_id, k.indbetalt, k.haevet, k.indbetalt - k.haevet as beloeb
  from (select b.id as bodekasse_id,
               coalesce((select sum(i.beloeb) from public.indbetaling i
                          where i.bodekasse_id = b.id and i.annulleret is null), 0)::int as indbetalt,
               coalesce((select sum(h.beloeb) from public.haevning h
                          where h.bodekasse_id = b.id and h.annulleret is null), 0)::int as haevet
          from public.bodekasse b) k;

-- Per Medlem per Sæson: Bøder i alt (borne Bøder + every Gebyr kind; the
-- Topliste ranks by it), Indbetalt, and Overført = Saldo at the Sæson's start.
create view public.medlem_saeson_tal with (security_invoker = true) as
with bevaegelse as (
  select saeson_id, baerer_id as medlem_id, pris as boeder, 0 as indbetalt
    from public.bode_baerer where baerer_id is not null
  union all
  select saeson_id, medlem_id, beloeb, 0 from public.gebyr where annulleret is null
  union all
  select saeson_id, medlem_id, 0, beloeb from public.indbetaling where annulleret is null
), pr_saeson as (
  select saeson_id, medlem_id, sum(boeder) as boeder, sum(indbetalt) as indbetalt
    from bevaegelse group by saeson_id, medlem_id
)
select m.bodekasse_id,
       s.id                                  as saeson_id,
       m.id                                  as medlem_id,
       coalesce(p.boeder, 0)::int            as boeder_i_alt,
       coalesce(p.indbetalt, 0)::int         as indbetalt,
       coalesce((select sum(f.boeder - f.indbetalt)
                   from pr_saeson f join public.saeson fs on fs.id = f.saeson_id
                  where f.medlem_id = m.id and fs.loebenr < s.loebenr), 0)::int as overfoert
  from public.medlem m
  join public.saeson s on s.bodekasse_id = m.bodekasse_id
  left join pr_saeson p on p.saeson_id = s.id and p.medlem_id = m.id;

-- Per Bødekategori per Sæson: how many (not annulled) Bøder used it, and
-- whether it is among the five most used active ones ("Ofte brugt").
create view public.bodekategori_brug with (security_invoker = true) as
with brug as (
  select saeson_id, bodekategori_id, count(*) as antal
    from public.bode
   where annulleret is null and bodekategori_id is not null
   group by saeson_id, bodekategori_id
)
select k.bodekasse_id,
       s.id                              as saeson_id,
       k.id                              as bodekategori_id,
       coalesce(u.antal, 0)::int         as antal,
       k.arkiveret is null and coalesce(u.antal, 0) > 0
         and row_number() over (partition by s.id, k.arkiveret is null
                                order by coalesce(u.antal, 0) desc, lower(k.navn)) <= 5
                                         as ofte_brugt
  from public.bodekategori k
  join public.saeson s on s.bodekasse_id = k.bodekasse_id
  left join brug u on u.saeson_id = s.id and u.bodekategori_id = k.id;

-- For RPCs: the running Sæson (null = Pause) and the latest Sæson of a box.
create function private.aktiv_saeson(p_bodekasse uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select aktiv_saeson_id from public.bodekasse_saeson where bodekasse_id = p_bodekasse
$$;

create function private.seneste_saeson(p_bodekasse uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select seneste_saeson_id from public.bodekasse_saeson where bodekasse_id = p_bodekasse
$$;

-- ---------- RPC building blocks ----------
-- Every write RPC is `security definer set search_path = ''` in public and:
--   1. resolves the caller:  v_mig := private.mit_medlem(box)  (or mit_admin)
--   2. checks its rules (role, Sæson state, setting on, window, limits)
--   3. writes the row, any Gebyr and its feed entry (private.tilfoej_haendelse)
--   4. ignores a repeat of the client-made one-time ID:
--        v_tidligere := private.start_kald(p_klient_id, '<rpc name>');
--        if v_tidligere is not null then return v_tidligere; end if;
--        ... work ...
--        return private.afslut_kald(p_klient_id, <answer jsonb>);
-- Errors: `raise exception '<snake_case_key>'`; the client maps the key to a
-- Danish string. Access errors use errcode 42501, rule errors the default P0001.
-- See supabase/tests/rpc_byggeklodser_test.sql for a worked example.

-- The caller's active Medlem id in a box. Rejects no login, non-Medlem and Udmeldt.
create function private.mit_medlem(p_bodekasse uuid) returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare v_id uuid;
begin
  select id into v_id from public.medlem
   where bodekasse_id = p_bodekasse and user_id = (select auth.uid()) and udmeldt is null;
  if v_id is null then
    raise exception 'ikke_medlem' using errcode = '42501';
  end if;
  return v_id;
end $$;

-- Like mit_medlem, but the caller must also be an Admin of the box.
create function private.mit_admin(p_bodekasse uuid) returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare v_id uuid := private.mit_medlem(p_bodekasse);
begin
  if not exists (select 1 from public.medlem where id = v_id and er_admin) then
    raise exception 'ikke_admin' using errcode = '42501';
  end if;
  return v_id;
end $$;

-- One row per client-made one-time ID, with the answer the first call gave.
create table private.kald (
  klient_id  uuid primary key,
  user_id    uuid not null,
  rpc        text not null,
  svar       jsonb,
  tid        timestamptz not null default now()
);

-- Claims a one-time ID. Returns null the first time (go ahead), or the stored
-- answer on a repeat. A concurrent repeat waits for the first call to commit.
create function private.start_kald(p_klient_id uuid, p_rpc text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_kald private.kald;
begin
  if p_klient_id is null then
    raise exception 'mangler_klient_id';
  end if;
  insert into private.kald (klient_id, user_id, rpc)
  values (p_klient_id, (select auth.uid()), p_rpc)
  on conflict (klient_id) do nothing;
  if found then
    return null;
  end if;
  select * into v_kald from private.kald where klient_id = p_klient_id;
  if v_kald.user_id is distinct from (select auth.uid()) or v_kald.rpc <> p_rpc then
    raise exception 'klient_id_brugt';
  end if;
  return coalesce(v_kald.svar, '{}'::jsonb);
end $$;

-- Stores the answer for a one-time ID and returns it.
create function private.afslut_kald(p_klient_id uuid, p_svar jsonb default '{}') returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
begin
  update private.kald set svar = coalesce(p_svar, '{}'::jsonb) where klient_id = p_klient_id;
  return coalesce(p_svar, '{}'::jsonb);
end $$;

-- Appends a feed entry. The Sæson defaults to the box's latest one.
create function private.tilfoej_haendelse(
  p_bodekasse  uuid,
  p_aktoer     uuid,
  p_art        text,
  p_data       jsonb default '{}',
  p_ref_tabel  text  default null,
  p_ref_id     uuid  default null,
  p_batch_id   uuid  default null,
  p_modtager   uuid  default null,
  p_saeson     uuid  default null
) returns bigint
language plpgsql volatile security definer set search_path = '' as $$
declare v_id bigint;
begin
  insert into public.haendelse (bodekasse_id, saeson_id, aktoer_id, art, data,
                                ref_tabel, ref_id, batch_id, modtager_id)
  values (p_bodekasse, coalesce(p_saeson, private.seneste_saeson(p_bodekasse)), p_aktoer,
          p_art, coalesce(p_data, '{}'::jsonb), p_ref_tabel, p_ref_id, p_batch_id, p_modtager)
  returning id into v_id;
  return v_id;
end $$;

-- ---------- Read-only RLS ----------

alter table public.bodekasse enable row level security;
create policy laes on public.bodekasse for select to authenticated
  using (id in (select private.mine_bodekasser()));

alter table public.bodekasse_kode enable row level security;
create policy laes_admin on public.bodekasse_kode for select to authenticated
  using (bodekasse_id in (select private.admin_bodekasser()));

alter table public.medlem enable row level security;
create policy laes on public.medlem for select to authenticated
  using (bodekasse_id in (select private.mine_bodekasser()));

alter table public.saeson enable row level security;
create policy laes on public.saeson for select to authenticated
  using (bodekasse_id in (select private.mine_bodekasser()));

-- Every other tenant table: the same one-line policy. Copy it for new tables.
do $$
declare t text;
begin
  foreach t in array array['bodekategori', 'bode', 'anke', 'frikob', 'konkurrence',
                           'konkurrence_resultat', 'gebyr', 'betalingsmelding',
                           'indbetaling', 'haevning', 'haendelse']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format($p$create policy laes on public.%I for select to authenticated
                      using (bodekasse_id in (select private.mine_bodekasser()))$p$, t);
  end loop;
end $$;

-- ---------- Grants ----------

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
grant select on all tables in schema public to authenticated;

-- Future objects too: later migrations must grant explicitly, e.g.
--   grant select on public.<new table or view> to authenticated;
--   grant execute on function public.<rpc>(...) to authenticated;
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on functions from anon, authenticated;
alter default privileges for role postgres
  revoke execute on functions from public;

revoke all on all tables in schema private from public, anon, authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.mine_bodekasser(), private.admin_bodekasser() to authenticated;
