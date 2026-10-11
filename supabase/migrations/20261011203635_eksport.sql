-- #70: Eksportér data.
--
-- public.eksport_saeson: every Bøde, Gebyr, Indbetaling and Hævning of one
-- Sæson, for the Admin's CSV download. The client writes the CSV.
-- Written with `create or replace` so the file can be re-applied by hand.

-- One row per money event in the Sæson, oldest first. Annulled rows stay in.
--   art         'bode' | 'engangsbode' | 'gebyr' | 'indbetaling' | 'haevning'
--   gebyr_art   the Gebyr's kind (Gebyrer only)
--   medlem      who got the Bøde / pays the Gebyr / paid in (null: Hævning)
--   af          who gave the Bøde / registered the money (null: Gebyr)
--   hvad        Bødekategori or reason; for a Gebyr its cause (Bødekategori,
--               Engangsbøde reason, Konkurrence title); the Indbetaling's
--               note; the Hævning's purpose
--   anke        Bøder only: null (no Anke), 'afventer', or the afgørelse
-- Errors: ikke_medlem / ikke_admin (42501), ikke_fundet (Sæson not in box).
create or replace function public.eksport_saeson(p_bodekasse uuid, p_saeson uuid)
returns table (
  tid             timestamptz,
  art             text,
  gebyr_art       public.gebyr_art,
  medlem          text,
  af              text,
  hvad            text,
  beloeb          int,
  anke            text,
  annulleret      timestamptz,
  annulleret_note text)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.mit_admin(p_bodekasse);
  if not exists (select 1 from public.saeson s
                  where s.id = p_saeson and s.bodekasse_id = p_bodekasse) then
    raise exception 'ikke_fundet';
  end if;

  return query
  with poster as (
    select b.givet as tid,
           case when b.bodekategori_id is null then 'engangsbode' else 'bode' end as art,
           null::public.gebyr_art as gebyr_art,
           mo.navn as medlem, gi.navn as af,
           coalesce(k.navn, b.grund) as hvad,
           b.pris as beloeb,
           case when a.id is null then null
                when a.afgoerelse is null then 'afventer'
                else a.afgoerelse::text end as anke,
           b.annulleret, b.annulleret_note
      from public.bode b
      join public.medlem mo on mo.id = b.modtager_id
      join public.medlem gi on gi.id = b.giver_id
      left join public.bodekategori k on k.id = b.bodekategori_id
      left join public.anke a on a.bode_id = b.id
     where b.bodekasse_id = p_bodekasse and b.saeson_id = p_saeson

    union all
    select g.oprettet, 'gebyr', g.art, m.navn, null,
           coalesce(ko.titel, gk.navn, ab_k.navn, ab.grund, gb.grund, fk.navn),
           g.beloeb, null, g.annulleret, g.annulleret_note
      from public.gebyr g
      join public.medlem m on m.id = g.medlem_id
      left join public.bodekategori gk on gk.id = g.bodekategori_id      -- oprettelse
      left join public.bode gb on gb.id = g.bode_id                      -- engangsbode
      left join public.anke an on an.id = g.anke_id                      -- anke
      left join public.bode ab on ab.id = an.bode_id
      left join public.bodekategori ab_k on ab_k.id = ab.bodekategori_id
      left join public.frikob f on f.id = g.frikob_id                    -- frikob
      left join public.bodekategori fk on fk.id = f.bodekategori_id
      left join public.konkurrence ko on ko.id = g.konkurrence_id        -- placering / fravaer
     where g.bodekasse_id = p_bodekasse and g.saeson_id = p_saeson

    union all
    select i.registreret, 'indbetaling', null, m.navn, r.navn, i.note,
           i.beloeb, null, i.annulleret, i.annulleret_note
      from public.indbetaling i
      join public.medlem m on m.id = i.medlem_id
      join public.medlem r on r.id = i.registreret_af
     where i.bodekasse_id = p_bodekasse and i.saeson_id = p_saeson

    union all
    select h.registreret, 'haevning', null, null, r.navn, h.formaal,
           h.beloeb, null, h.annulleret, h.annulleret_note
      from public.haevning h
      join public.medlem r on r.id = h.registreret_af
     where h.bodekasse_id = p_bodekasse and h.saeson_id = p_saeson
  )
  select p.tid, p.art, p.gebyr_art, p.medlem, p.af, p.hvad, p.beloeb, p.anke,
         p.annulleret, p.annulleret_note
    from poster p
   -- A cause before its Gebyr when they share a moment (a Bøde, then its Gebyr).
   order by p.tid, p.art = 'gebyr', p.art;
end $$;

revoke execute on function public.eksport_saeson(uuid, uuid) from public, anon;
grant execute on function public.eksport_saeson(uuid, uuid) to authenticated;
