-- Review fix: the "Sæson ended" feed entry is dated when the Sæson ended.
--
-- A Sæson that ends by its date gets its entry lazily, at the next "Start ny
-- sæson". It used to be stamped with that later moment; now it is stamped
-- with the Sæson's actual end (saeson_status.slutter: `afsluttet`, or
-- Copenhagen midnight after `slutdato`), so it sorts into the right place.

-- ---------- saeson_afsluttet_haendelse (from 20261011195044_saeson.sql) ----------
create or replace function private.saeson_afsluttet_haendelse(p_saeson uuid, p_aktoer uuid)
returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_saeson  public.saeson;
  v_slutter timestamptz;
  v_id      bigint;
begin
  select * into v_saeson from public.saeson where id = p_saeson;
  if exists (select 1 from public.haendelse
              where saeson_id = p_saeson and art = 'saeson_afsluttet') then
    return;
  end if;
  v_slutter := least(v_saeson.afsluttet,
                     (v_saeson.slutdato + 1)::timestamp at time zone 'Europe/Copenhagen');
  v_id := private.tilfoej_haendelse(
    v_saeson.bodekasse_id, p_aktoer, 'saeson_afsluttet',
    jsonb_build_object('saeson_navn', v_saeson.navn),
    'saeson', v_saeson.id, p_saeson => v_saeson.id);
  if v_slutter is not null then
    update public.haendelse set tid = least(v_slutter, tid) where id = v_id;
  end if;
end $$;

revoke execute on function private.saeson_afsluttet_haendelse(uuid, uuid) from public, anon, authenticated;
