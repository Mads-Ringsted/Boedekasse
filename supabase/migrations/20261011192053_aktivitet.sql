-- #55: Aktivitet feed and Bøde detail (read views only, no RPCs).
--
-- public.aktivitet_bode: one row per Bøde with everything the Bøde detail
--   sheet and a feed row show (names, live Anke state, annulled, Gebyr).
-- public.aktivitet: one row per feed entry (haendelse) with its live state.
--   Page it newest first (`order by id desc`), per box and Sæson; filter to
--   one Medlem with `involverede @> array[medlem]` (PostgREST `cs`).
--
-- Both are security_invoker, so the base tables' RLS (own boxes only) applies.

create view public.aktivitet_bode with (security_invoker = true) as
select b.id,
       b.bodekasse_id,
       b.saeson_id,
       b.batch_id,
       b.giver_id,
       g.navn                                   as giver_navn,
       b.modtager_id,
       m.navn                                   as modtager_navn,
       b.bodekategori_id,
       coalesce(k.navn, b.grund)                as navn,
       b.grund is not null                      as engangsbode,
       b.pris,
       b.givet,
       b.anke_id,
       b.afgoerelse,
       b.anket,
       coalesce(an.aendret, false)              as afgoerelse_aendret,
       b.baerer_id,
       b.annulleret,
       b.annulleret_af,
       x.navn                                   as annulleret_af_navn,
       b.annulleret_note,
       -- The Engangsbøde Gebyr the giver pays (not annulled); 0 for the rest.
       coalesce((select sum(gb.beloeb) from public.gebyr gb
                  where gb.bode_id = b.id and gb.annulleret is null), 0)::int as gebyr
  from public.bode_baerer b
  join public.medlem g on g.id = b.giver_id
  join public.medlem m on m.id = b.modtager_id
  left join public.bodekategori k on k.id = b.bodekategori_id
  left join public.anke an on an.id = b.anke_id
  left join public.medlem x on x.id = b.annulleret_af;

create view public.aktivitet with (security_invoker = true) as
select h.id,
       h.bodekasse_id,
       h.saeson_id,
       h.tid,
       h.art,
       h.aktoer_id,
       a.navn        as aktoer_navn,
       h.modtager_id,
       m.navn        as modtager_navn,
       h.batch_id,
       h.ref_tabel,
       h.ref_id,
       h.data,
       r.annulleret,
       r.annulleret_af,
       x.navn        as annulleret_af_navn,
       r.annulleret_note,
       bo.boeder,
       ge.gebyrer,
       array_remove(array[h.aktoer_id, h.modtager_id], null)
         || coalesce(ge.betalere, '{}')                  as involverede
  from public.haendelse h
  left join public.medlem a on a.id = h.aktoer_id
  left join public.medlem m on m.id = h.modtager_id
  -- The annullable row the entry is about (ref_tabel/ref_id), if any. An
  -- entry ABOUT an annulment must not point here, or it shows struck too.
  left join lateral (
              select t.annulleret, t.annulleret_af, t.annulleret_note from public.bode t
               where h.ref_tabel = 'bode' and t.id = h.ref_id
    union all select t.annulleret, t.annulleret_af, t.annulleret_note from public.gebyr t
               where h.ref_tabel = 'gebyr' and t.id = h.ref_id
    union all select t.annulleret, t.annulleret_af, t.annulleret_note from public.indbetaling t
               where h.ref_tabel = 'indbetaling' and t.id = h.ref_id
    union all select t.annulleret, t.annulleret_af, t.annulleret_note from public.haevning t
               where h.ref_tabel = 'haevning' and t.id = h.ref_id
    union all select t.annulleret, t.annulleret_af, t.annulleret_note from public.frikob t
               where h.ref_tabel = 'frikob' and t.id = h.ref_id
    union all select t.annulleret, t.annulleret_af, t.annulleret_note from public.konkurrence t
               where h.ref_tabel = 'konkurrence' and t.id = h.ref_id
  ) r on true
  left join public.medlem x on x.id = r.annulleret_af
  -- A Giv batch row: this receiver's Bøder in the batch, oldest first.
  left join lateral (
    select jsonb_agg(to_jsonb(ab) order by ab.givet, ab.navn, ab.id) as boeder
      from public.aktivitet_bode ab
     where h.batch_id is not null and ab.batch_id = h.batch_id and ab.modtager_id = h.modtager_id
  ) bo on true
  -- The Gebyrer the entry's cause charged (annulled ones too, marked), so a
  -- Gebyr sits on its cause's row. A Bødekategori's creation Gebyr shows on
  -- its created row only; an Engangsbøde's Gebyr is in `boeder` instead.
  left join lateral (
    select jsonb_agg(jsonb_build_object(
             'id', g.id, 'art', g.art, 'beloeb', g.beloeb,
             'medlem_id', g.medlem_id, 'medlem_navn', gm.navn,
             'annulleret', g.annulleret, 'annulleret_af', g.annulleret_af,
             'annulleret_af_navn', gx.navn, 'annulleret_note', g.annulleret_note)
             order by g.oprettet, g.id)        as gebyrer,
           array_agg(distinct g.medlem_id)     as betalere
      from public.gebyr g
      join public.medlem gm on gm.id = g.medlem_id
      left join public.medlem gx on gx.id = g.annulleret_af
     where case h.ref_tabel
             when 'bodekategori' then h.art = 'bodekategori_oprettet' and g.art = 'oprettelse'
                                      and g.bodekategori_id = h.ref_id
             when 'anke'         then g.anke_id = h.ref_id
             when 'frikob'       then g.frikob_id = h.ref_id
             when 'konkurrence'  then g.konkurrence_id = h.ref_id
             else false
           end
  ) ge on true;

grant select on public.aktivitet_bode, public.aktivitet to authenticated;
