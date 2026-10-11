-- Review fix: Udmeldt no longer rewrites past Topliste.
--
-- The latest Sæson's Topliste leaves out every Udmeldt Medlem. A past
-- Sæson's Topliste stays as it ended: it leaves out only those Udmeldt
-- before it ended. Columns unchanged (from 20261011191906_hjem_tal.sql).
create or replace view public.topliste with (security_invoker = true) as
select t.bodekasse_id, t.saeson_id, t.medlem_id, m.navn,
       t.boeder_i_alt, t.indbetalt,
       rank() over (partition by t.saeson_id order by t.boeder_i_alt desc) as plads
  from public.medlem_saeson_tal t
  join public.medlem m on m.id = t.medlem_id
  join public.saeson_status s on s.id = t.saeson_id
 where m.udmeldt is null
    or (not s.er_seneste and m.udmeldt >= s.slutter);
