-- #88 (spec #74 "Push"): the push kind "Aktivitet fra andre", part 1.
--
-- A new enum value can't be used in the transaction that adds it, so the
-- value and its toggle column come first, in their own migration (as in
-- 20261101170000_gebyr_art_automatik.sql). The pushes themselves are in
-- 20261102100100_push_andres_aktivitet.sql.
--
-- Additive only. The toggle is off by default, unlike every other kind: it is
-- opt-in. The column name matches the enum label, as private.push_til needs.

alter type public.push_art add value if not exists 'andres_aktivitet';

alter table public.push_praeference
  add column andres_aktivitet boolean not null default false;
