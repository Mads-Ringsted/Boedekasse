-- Review fix: correcting a Konkurrence keeps the old result.
--
-- Nothing is deleted except a Fortryd batch. ret_konkurrence used to delete
-- the old konkurrence_resultat rows; now it annuls them (note "rettet") and
-- writes the new result next to them. Reads use only the current rows
-- (annulleret is null).

alter table public.konkurrence_resultat
  add column id              uuid not null default gen_random_uuid(),
  add column annulleret      timestamptz,
  add column annulleret_af   uuid,
  add column annulleret_note text,
  add foreign key (bodekasse_id, annulleret_af) references public.medlem (bodekasse_id, id);

-- One current row per Medlem per Konkurrence; annulled ones pile up beside it.
alter table public.konkurrence_resultat drop constraint konkurrence_resultat_pkey;
alter table public.konkurrence_resultat add primary key (id);
create unique index konkurrence_resultat_aktuel_idx
  on public.konkurrence_resultat (konkurrence_id, medlem_id) where annulleret is null;

-- ---------- ret_konkurrence (from 20261011195010_konkurrence.sql) ----------
-- Same as before, except the old result rows are annulled, not deleted.
create or replace function public.ret_konkurrence(
  p_klient_id uuid, p_konkurrence uuid, p_titel text, p_dato date, p_placeringer jsonb)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_k         public.konkurrence := private.min_konkurrence(p_konkurrence);
  v_mig       uuid := private.mit_medlem(v_k.bodekasse_id);
  v_tidligere jsonb;
  v_titel     text;
  v_saeson    uuid;
  v_deltagere uuid[];
begin
  v_tidligere := private.start_kald(p_klient_id, 'ret_konkurrence');
  if v_tidligere is not null then return v_tidligere; end if;

  if v_k.annulleret is not null then raise exception 'allerede_annulleret'; end if;
  v_saeson := private.aktiv_saeson(v_k.bodekasse_id);
  if v_saeson is null then raise exception 'pause'; end if;
  if v_k.saeson_id <> v_saeson then raise exception 'tidligere_saeson'; end if;
  v_titel := private.konkurrence_titel(p_titel);

  v_deltagere := array(select medlem_id from public.konkurrence_resultat
                        where konkurrence_id = v_k.id and annulleret is null);
  update public.gebyr
     set annulleret = now(), annulleret_af = v_mig, annulleret_note = 'rettet'
   where konkurrence_id = v_k.id and annulleret is null;
  update public.konkurrence_resultat
     set annulleret = now(), annulleret_af = v_mig, annulleret_note = 'rettet'
   where konkurrence_id = v_k.id and annulleret is null;
  perform private.saet_konkurrence_resultat(v_k.bodekasse_id, v_k.id, p_placeringer, v_deltagere);

  update public.konkurrence
     set titel = v_titel, dato = coalesce(p_dato, dato), rettet_af = v_mig, rettet = now()
   where id = v_k.id;
  return private.afslut_kald(p_klient_id, '{}');
end $$;

-- ---------- konkurrence_resultat_visning (from 20261011195010_konkurrence.sql) ----------
-- Same columns; only the current result (old rows from a correction are left out).
create or replace view public.konkurrence_resultat_visning with (security_invoker = true) as
select r.konkurrence_id,
       r.bodekasse_id,
       r.medlem_id,
       m.navn                   as medlem_navn,
       m.user_id is not null    as logget_ind,
       r.plads,
       g.beloeb
  from public.konkurrence_resultat r
  join public.medlem m on m.id = r.medlem_id
  left join lateral (
    select gb.beloeb from public.gebyr gb
     where gb.konkurrence_id = r.konkurrence_id and gb.medlem_id = r.medlem_id
     order by gb.annulleret is null desc, gb.oprettet desc, gb.id
     limit 1
  ) g on true
 where r.annulleret is null;
