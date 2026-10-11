-- Hjem's figures (#54).

-- Kassen gains ikke_betalt: "I alt ikke betalte bøder" = what every Medlem
-- owes (positive Saldo), Udmeldte included, across all Sæsoner. Til gode
-- never offsets someone else's debt. Columns before it are unchanged.
create or replace view public.kassen with (security_invoker = true) as
select k.bodekasse_id, k.indbetalt, k.haevet, k.indbetalt - k.haevet as beloeb,
       k.ikke_betalt
  from (select b.id as bodekasse_id,
               coalesce((select sum(i.beloeb) from public.indbetaling i
                          where i.bodekasse_id = b.id and i.annulleret is null), 0)::int as indbetalt,
               coalesce((select sum(h.beloeb) from public.haevning h
                          where h.bodekasse_id = b.id and h.annulleret is null), 0)::int as haevet,
               coalesce((select sum(s.saldo) from public.medlem_saldo s
                          where s.bodekasse_id = b.id and s.saldo > 0), 0)::int as ikke_betalt
          from public.bodekasse b) k;

-- The Topliste per Sæson: every active Medlem (Udmeldte left out) with
-- Bøder i alt (borne Bøder + every Gebyr kind) and Indbetalt in that Sæson.
-- plads ranks by Bøder i alt; ties share a place and skip the next (1, 2, 2, 4).
create view public.topliste with (security_invoker = true) as
select t.bodekasse_id, t.saeson_id, t.medlem_id, m.navn,
       t.boeder_i_alt, t.indbetalt,
       rank() over (partition by t.saeson_id order by t.boeder_i_alt desc) as plads
  from public.medlem_saeson_tal t
  join public.medlem m on m.id = t.medlem_id
 where m.udmeldt is null;

grant select on public.topliste to authenticated;
