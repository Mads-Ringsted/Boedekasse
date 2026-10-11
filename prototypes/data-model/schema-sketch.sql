-- =====================================================================
-- PROTOTYPE — rough schema sketch for "Data model and access rules" (#40).
-- Not a migration. Not run. Mirrors data-model-prototype.html.
-- Auth helpers + claim triggers: see docs/research/supabase-auth-and-rls.md.
-- =====================================================================

-- ---------- Principles ----------
-- 1. Every tenant table has bodekasse_id; references between tenant rows are
--    composite FKs (bodekasse_id, x_id) so cross-box links are impossible.
-- 2. Reads: RLS select policy "bodekasse_id in (select private.mine_bodekasser())"
--    on every table. Udmeldte Medlemmer are excluded from mine_bodekasser().
-- 3. Writes: only through public RPCs (security definer). They check the rules,
--    and write the row + any Gebyr + a haendelse in one transaction.
--    authenticated has NO insert/update/delete grant on any table.
-- 4. Saldo, Kassen, Topliste are views (security_invoker), never stored.
-- 5. Nothing is deleted except a Fortryd batch. Corrections set annulleret_*.
-- 6. Amounts are whole kroner: int, check > 0 (Konkurrence Gebyrer may be 0).

create type gebyr_art as enum ('oprettelse', 'engangsbode', 'anke', 'frikob', 'placering', 'fravaer');
create type anke_afgoerelse as enum ('modtager_vandt', 'giver_vandt', 'ikke_afgjort');
create type melding_status as enum ('afventer', 'bekraeftet', 'afvist', 'trukket');

-- ---------- Box, settings, people ----------
create table bodekasse (
  id               uuid primary key default gen_random_uuid(),
  navn             text not null,
  join_kode        text not null unique,          -- e.g. K7P2QX, Admin-only read via RPC
  mobilepay_box    text,
  -- settings (one row per box; flat columns, defaults = "new box")
  anke_til             boolean not null default false,
  anke_vindue_timer    int     not null default 24,
  anke_min             int     not null default 1,
  anke_max_gange       numeric not null default 2,
  oprettelsesgebyr_til boolean not null default false,
  oprettelsesgebyr     int     not null default 25,
  engangsgebyr_til     boolean not null default true,
  engangsgebyr         int     not null default 10,
  frikob_til           boolean not null default false,
  frikob_pris          int     not null default 300,
  konkurrence_til      boolean not null default false,
  placeringer          int[]   not null default '{0,10,25,35,40,45,50}',
  fravaersgebyr        int     not null default 50,
  oprettet           timestamptz not null default now()
);
-- join_kode must not be readable by non-Admins: keep it in a side table or
-- expose bodekasse through a view without it. (Open detail.)

create table medlem (
  id            uuid primary key default gen_random_uuid(),
  bodekasse_id  uuid not null references bodekasse on delete cascade,
  navn          text not null,
  email         text check (email = lower(email)),     -- null when joined by code
  user_id       uuid references auth.users on delete set null,
  er_admin      boolean not null default false,
  udmeldt       timestamptz,                            -- null = active
  unique (bodekasse_id, id),
  unique (bodekasse_id, email),
  unique (bodekasse_id, user_id)
);
-- trigger: last active Admin can't lose er_admin or be udmeldt.
-- trigger: claim on confirm / on insert (research doc §2).

create table saeson (
  id            uuid primary key default gen_random_uuid(),
  bodekasse_id  uuid not null references bodekasse on delete cascade,
  navn          text not null,                          -- default 'Sæson ' || year
  startet       timestamptz not null default now(),
  slutdato      date,                                   -- planned; ends at midnight Copenhagen after it
  afsluttet     timestamptz,                            -- "Afslut sæson nu"
  unique (bodekasse_id, id)
);
-- Only the latest saeson of a box may be running. "Running" is computed:
create function private.aktiv_saeson(p_box uuid) returns uuid language sql stable as $$
  select id from saeson
   where bodekasse_id = p_box
     and now() < least(coalesce(afsluttet, 'infinity'),
                       coalesce(((slutdato + 1)::timestamp at time zone 'Europe/Copenhagen'), 'infinity'))
   order by startet desc limit 1
$$;
create function private.seneste_saeson(p_box uuid) returns uuid language sql stable as $$
  select id from saeson where bodekasse_id = p_box order by startet desc limit 1
$$;

-- ---------- Charges ----------
create table bodekategori (
  id            uuid primary key default gen_random_uuid(),
  bodekasse_id  uuid not null references bodekasse on delete cascade,
  navn          text not null,
  pris          int  not null check (pris > 0),
  beskrivelse   text,
  arkiveret     timestamptz,
  oprettet_af   uuid not null,
  oprettet      timestamptz not null default now(),
  unique (bodekasse_id, id),
  foreign key (bodekasse_id, oprettet_af) references medlem (bodekasse_id, id)
);
create unique index on bodekategori (bodekasse_id, lower(navn)) where arkiveret is null;

create table bode (
  id               uuid primary key default gen_random_uuid(),
  bodekasse_id     uuid not null,
  saeson_id        uuid not null,
  batch_id         uuid not null,                       -- one Giv bøder submit
  giver_id         uuid not null,
  modtager_id      uuid not null,
  bodekategori_id  uuid,                                -- null = Engangsbøde
  grund            text,                                -- Engangsbøde reason
  pris             int not null check (pris > 0),       -- kept price
  givet            timestamptz not null default now(),
  annulleret       timestamptz, annulleret_af uuid, annulleret_note text,
  check ((bodekategori_id is null) = (grund is not null)),
  unique (bodekasse_id, id),
  foreign key (bodekasse_id, saeson_id) references saeson (bodekasse_id, id),
  foreign key (bodekasse_id, giver_id) references medlem (bodekasse_id, id),
  foreign key (bodekasse_id, modtager_id) references medlem (bodekasse_id, id),
  foreign key (bodekasse_id, bodekategori_id) references bodekategori (bodekasse_id, id)
);

create table anke (
  id            uuid primary key default gen_random_uuid(),
  bodekasse_id  uuid not null,
  saeson_id     uuid not null,
  bode_id       uuid not null unique,                   -- one Anke per Bøde, ever
  indgivet      timestamptz not null default now(),
  afgoerelse    anke_afgoerelse,                        -- null = pending
  afgjort_af    uuid,
  afgjort       timestamptz,
  aendret       boolean not null default false,         -- "Afgørelse ændret"
  unique (bodekasse_id, id),
  foreign key (bodekasse_id, bode_id) references bode (bodekasse_id, id)
);

create table frikob (
  id               uuid primary key default gen_random_uuid(),
  bodekasse_id     uuid not null,
  saeson_id        uuid not null,
  medlem_id        uuid not null,
  bodekategori_id  uuid not null,
  koebt            timestamptz not null default now(),
  registreret_af   uuid not null,
  annulleret       timestamptz, annulleret_af uuid, annulleret_note text,
  unique (bodekasse_id, id)
);
create unique index on frikob (saeson_id, medlem_id, bodekategori_id) where annulleret is null;

create table konkurrence (
  id            uuid primary key default gen_random_uuid(),
  bodekasse_id  uuid not null,
  saeson_id     uuid not null,
  titel         text not null,
  dato          date not null default current_date,
  oprettet_af   uuid not null,
  rettet_af     uuid,
  annulleret    timestamptz, annulleret_af uuid, annulleret_note text,
  unique (bodekasse_id, id)
);
create table konkurrence_resultat (                     -- replaced wholesale on correction
  konkurrence_id uuid not null references konkurrence on delete cascade,
  bodekasse_id   uuid not null,
  medlem_id      uuid not null,
  plads          int check (plads > 0),                 -- null = fraværende
  primary key (konkurrence_id, medlem_id)
);

create table gebyr (
  id               uuid primary key default gen_random_uuid(),
  bodekasse_id     uuid not null,
  saeson_id        uuid not null,
  medlem_id        uuid not null,                       -- who pays
  art              gebyr_art not null,
  beloeb           int not null check (beloeb >= 0),
  -- exactly one cause, matching art:
  bodekategori_id  uuid,      -- oprettelse
  bode_id          uuid,      -- engangsbode
  anke_id          uuid,      -- anke
  frikob_id        uuid,      -- frikob
  konkurrence_id   uuid,      -- placering / fravaer
  oprettet         timestamptz not null default now(),
  annulleret       timestamptz, annulleret_af uuid, annulleret_note text,
  check (num_nonnulls(bodekategori_id, bode_id, anke_id, frikob_id, konkurrence_id) = 1),
  check (beloeb > 0 or art = 'placering')
);

-- ---------- Money ----------
create table betalingsmelding (
  id            uuid primary key default gen_random_uuid(),
  bodekasse_id  uuid not null,
  medlem_id     uuid not null,
  beloeb        int not null check (beloeb > 0),
  status        melding_status not null default 'afventer',
  behandlet_af  uuid,
  meldt         timestamptz not null default now(),
  behandlet     timestamptz
);
create table indbetaling (
  id                   uuid primary key default gen_random_uuid(),
  bodekasse_id         uuid not null,
  saeson_id            uuid not null,                   -- latest Sæson, Pause included
  medlem_id            uuid not null,
  beloeb               int not null check (beloeb > 0),
  note                 text,
  registreret_af       uuid not null,                   -- Admin, or the confirmer
  betalingsmelding_id  uuid unique references betalingsmelding,
  registreret          timestamptz not null default now(),
  annulleret           timestamptz, annulleret_af uuid, annulleret_note text
);
create table haevning (
  id              uuid primary key default gen_random_uuid(),
  bodekasse_id    uuid not null,
  saeson_id       uuid not null,
  beloeb          int not null check (beloeb > 0),
  formaal         text not null,
  registreret_af  uuid not null,
  registreret     timestamptz not null default now(),
  annulleret      timestamptz, annulleret_af uuid, annulleret_note text
);

-- ---------- Activity feed (append-only) ----------
create table haendelse (
  id            bigint generated always as identity primary key,
  bodekasse_id  uuid not null,
  saeson_id     uuid not null,
  tid           timestamptz not null default now(),
  aktoer_id     uuid,                                   -- null for system (e.g. auto Sæson end)
  art           text not null,                          -- 'bode_givet', 'anke_afgjort', 'annulleret', ...
  -- one row per receiver per batch: bode rows grouped by (batch_id, modtager_id)
  batch_id      uuid, modtager_id uuid,
  ref_tabel     text, ref_id uuid,                      -- for strike-through lookup
  data          jsonb not null default '{}'             -- snapshot text bits (names, amounts)
);
create index on haendelse (bodekasse_id, saeson_id, tid desc);

-- ---------- Derived views ----------
create view bode_baerer with (security_invoker = true) as
select b.*,
  case
    when b.annulleret is not null then null
    when a.id is null then b.modtager_id
    when a.afgoerelse is null then null                    -- pending: "anket"
    when a.afgoerelse = 'modtager_vandt' then b.giver_id
    else b.modtager_id                                     -- giver_vandt / ikke_afgjort
  end as baerer_id
from bode b left join anke a on a.bode_id = b.id;

create view medlem_saldo with (security_invoker = true) as
select m.bodekasse_id, m.id as medlem_id,
  coalesce((select sum(pris)   from bode_baerer x where x.baerer_id = m.id), 0)
+ coalesce((select sum(beloeb) from gebyr g where g.medlem_id = m.id and g.annulleret is null), 0)
- coalesce((select sum(beloeb) from indbetaling i where i.medlem_id = m.id and i.annulleret is null), 0)
  as saldo
from medlem m;
-- Per-Sæson figures (Overført, Bøder i alt for the Topliste incl. Frikøbsgebyr,
-- Bødekategori top-5) are the same sums filtered by saeson_id.

create view kassen with (security_invoker = true) as
select b.id as bodekasse_id,
  coalesce((select sum(beloeb) from indbetaling i where i.bodekasse_id = b.id and i.annulleret is null), 0)
- coalesce((select sum(beloeb) from haevning h where h.bodekasse_id = b.id and h.annulleret is null), 0)
  as beloeb
from bodekasse b;

-- ---------- RLS (same shape on every table) ----------
-- alter table <t> enable row level security;
-- create policy "laes" on <t> for select to authenticated
--   using (bodekasse_id in (select private.mine_bodekasser()));
-- revoke insert, update, delete on <t> from authenticated, anon;
-- Exceptions: betalingsmelding visible to all Medlemmer (decided); join_kode Admin-only.

-- ---------- RPCs (public, security definer, search_path = '') ----------
-- Every RPC: resolve caller's medlem in the box, reject if Udmeldt.
-- opret_bodekasse(navn, mit_navn)            -> box + Admin medlem + first saeson
-- tilmeld_med_kode(kode, mit_navn)
-- giv_boeder(box, linjer jsonb)              -> running Sæson; Frikøb check; Engangsbøde Gebyr; haendelse per receiver
-- fortryd_batch(batch_id)                    -> caller is giver, within ~30 s server-side grace; hard delete
-- opret_bodekategori / ret_bodekategori / arkiver_bodekategori
-- anke(bode_id)                              -> receiver, running Sæson, window, draws Gebyr server-side, returns amount for the wheel
-- afgoer_anke(anke_id, vinder)               -> not a party; change = recorder or Admin; latest Sæson
-- annuller(tabel, id, note)                  -> per-table permission + cascades (Engangsbøde Gebyr, Frikøbsgebyr, Konkurrence Gebyrer)
-- koeb_frikob(medlem_id, bodekategori_id)
-- registrer_konkurrence(box, titel, dato, placeringer jsonb) / ret_konkurrence(id, placeringer jsonb)
-- registrer_indbetaling / meld_betaling / behandl_betalingsmelding(id, svar)
-- haev(box, beloeb, formaal)                 -> Admin, beloeb <= kassen (lock the box row)
-- saet_slutdato / afslut_saeson / start_saeson  -> start closes open Anker as 'ikke_afgjort'
-- udmeld / genoptag / saet_admin / slet_medlem (never-claimed, no rows only)
-- slet_bodekasse(navn_bekraeftelse) / slet_konto()
-- opdater_indstillinger(box, jsonb)          -> Admin
