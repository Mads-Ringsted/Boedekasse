-- Local fake data only: fills "FC Ølhunde" from supabase/seed.sql with a
-- Sæson's worth of Bøder, Anker, Indbetalinger and a Frikøb, plus an ended
-- earlier Sæson, so every card on the Statistik tab has something to show.
-- Never run this against production.
--
-- Run after `npm run db:reset` (or a fresh `npm run db:start`):
--   docker exec -i supabase_db_boedekasse psql -U postgres < scripts/statistik-demo.sql
-- Then log in as mads@example.com (see the top of supabase/seed.sql).

do $$
declare
  v_kasse uuid := '0e1a0000-0000-4000-8000-000000000001';
  v_saeson uuid;
  v_gammel uuid;
  v_start timestamptz := now() - interval '16 weeks';
  v_mads uuid := '0e1a0000-0000-4000-8000-000000000101';
  v_medlemmer uuid[];
  v_vaegt_giv int[] := array[6, 5, 2, 3, 3, 6, 4, 1];  -- per Medlem, seed order
  v_vaegt_faa int[] := array[3, 7, 2, 2, 4, 6, 5, 1];
  v_kategorier uuid[];
  v_priser int[];
  v_vaegt_kat int[];
  v_dum uuid;
  v_giver uuid;
  v_modtager uuid;
  v_k int;
  v_tid timestamptz;
  v_bode uuid;
  v_dage int;
  v_n int;
  i int;

begin
  if exists (select 1 from public.bode where bodekasse_id = v_kasse) then
    raise notice 'FC Ølhunde already has Bøder; skipping the Statistik demo data.';
    return;
  end if;
  perform setseed(0.42);

  select id into v_saeson from public.saeson where bodekasse_id = v_kasse order by loebenr desc limit 1;
  update public.saeson set startet = v_start where id = v_saeson;

  select array_agg(id order by oprettet, navn) into v_medlemmer
    from public.medlem where bodekasse_id = v_kasse;

  insert into public.bodekategori (bodekasse_id, navn, pris, oprettet_af, oprettet)
  values (v_kasse, 'Der ser du dum ud', 25, v_mads, v_start)
  returning id into v_dum;
  update public.bodekategori set oprettet = v_start where bodekasse_id = v_kasse;

  select array_agg(id order by navn), array_agg(pris order by navn) into v_kategorier, v_priser
    from public.bodekategori where bodekasse_id = v_kasse;
  -- Weights in the same (name) order, more for the common ones.
  select array_agg(case navn
           when 'For sent' then 12 when 'Telefon ved bordet' then 9 when 'Der ser du dum ud' then 8
           when 'Spildt drikke' then 7 when 'Bandeord' then 6 when 'Ikke drukket op' then 5
           when 'Glemt at melde afbud' then 3 when 'Glemt udstyr' then 2 when 'Gult kort' then 2
           else 1 end order by navn)
    into v_vaegt_kat from public.bodekategori where bodekasse_id = v_kasse;

  for i in 1..280 loop
    -- Who gives and who gets (never the same person).
    loop
      v_giver := v_medlemmer[(select x from (select x, sum(w) over (order by x) as c, sum(w) over () as t
                    from unnest(v_vaegt_giv) with ordinality u(w, x)) s
                    where c > (select random()) * t order by x limit 1)];
      v_modtager := v_medlemmer[(select x from (select x, sum(w) over (order by x) as c, sum(w) over () as t
                    from unnest(v_vaegt_faa) with ordinality u(w, x)) s
                    where c > (select random()) * t order by x limit 1)];
      exit when v_giver <> v_modtager;
    end loop;
    v_k := (select x from (select x, sum(w) over (order by x) as c, sum(w) over () as t
              from unnest(v_vaegt_kat) with ordinality u(w, x)) s
              where c > (select random()) * t order by x limit 1);

    -- When: a day in the Sæson (more lately), mostly Friday/Saturday evenings.
    v_dage := floor(power(random(), 0.8) * 111)::int;
    v_tid := date_trunc('day', (v_start + make_interval(days => v_dage)) at time zone 'Europe/Copenhagen');
    if random() < 0.55 then
      -- Push to the coming Friday or Saturday.
      v_tid := v_tid + make_interval(days => ((5 + (random() < 0.5)::int) - extract(isodow from v_tid)::int + 7) % 7);
      v_tid := v_tid + make_interval(hours => 19 + floor(random() * 6)::int, mins => floor(random() * 60)::int);
    else
      v_tid := v_tid + make_interval(hours => 8 + floor(random() * 14)::int, mins => floor(random() * 60)::int);
    end if;
    v_tid := v_tid at time zone 'Europe/Copenhagen';
    if v_tid > now() - interval '10 minutes' then v_tid := now() - make_interval(hours => 1 + i % 20); end if;

    insert into public.bode (bodekasse_id, saeson_id, batch_id, giver_id, modtager_id, bodekategori_id, pris, givet)
    values (v_kasse, v_saeson, gen_random_uuid(), v_giver, v_modtager, v_kategorier[v_k], v_priser[v_k], v_tid)
    returning id into v_bode;

    -- Some are appealed; most appeals are decided.
    if random() < 0.06 then
      insert into public.anke (bodekasse_id, saeson_id, bode_id, indgivet, afgoerelse, afgjort_af, afgjort)
      values (v_kasse, v_saeson, v_bode, v_tid + interval '1 hour',
              case when random() < 0.45 then 'modtager_vandt' when random() < 0.85 then 'giver_vandt' end::public.anke_afgoerelse,
              v_mads, v_tid + interval '1 day');
      update public.anke set afgjort = null, afgjort_af = null where bode_id = v_bode and afgoerelse is null;
    end if;
  end loop;

  -- A few Engangsbøder and two annulled Bøder (annulled ones never count).
  insert into public.bode (bodekasse_id, saeson_id, batch_id, giver_id, modtager_id, grund, pris, givet)
  values (v_kasse, v_saeson, gen_random_uuid(), v_medlemmer[2], v_medlemmer[6], 'Sang karaoke uden at blive spurgt', 60, now() - interval '20 days'),
         (v_kasse, v_saeson, gen_random_uuid(), v_mads, v_medlemmer[2], 'Kom i forkert trøje', 40, now() - interval '45 days');
  update public.bode set annulleret = givet + interval '5 min', annulleret_af = v_mads, annulleret_note = 'Fejl'
   where id in (select id from public.bode where bodekasse_id = v_kasse order by givet limit 2);

  -- Indbetalinger: each logged-in Medlem pays now and then.
  for i in 1..8 loop
    v_n := 1 + floor(random() * 4)::int;
    for v_k in 1..v_n loop
      insert into public.indbetaling (bodekasse_id, saeson_id, medlem_id, beloeb, registreret, registreret_af)
      values (v_kasse, v_saeson, v_medlemmer[i], (2 + floor(random() * 10)::int) * 25,
              v_start + make_interval(days => 10 + floor(random() * 100)::int), v_mads);
    end loop;
  end loop;

  -- A Frikøb with its Frikøbsgebyr.
  insert into public.frikob (bodekasse_id, saeson_id, medlem_id, bodekategori_id, registreret_af, koebt)
  values (v_kasse, v_saeson, v_medlemmer[7], v_kategorier[array_position(v_vaegt_kat, 12)], v_mads, now() - interval '30 days');

  -- An earlier, ended Sæson with a few Bøder (pick it in the period pill).
  insert into public.saeson (bodekasse_id, loebenr, navn, startet, slutdato, afsluttet)
  overriding system value
  values (v_kasse, 0, 'Sæson ' || (extract(year from now()) - 1), now() - interval '60 weeks', null, now() - interval '20 weeks')
  returning id into v_gammel;
  for i in 1..40 loop
    loop
      v_giver := v_medlemmer[1 + floor(random() * 7)::int];
      v_modtager := v_medlemmer[1 + floor(random() * 7)::int];
      exit when v_giver <> v_modtager;
    end loop;
    v_k := case when random() < 0.4 then array_position(v_kategorier, v_dum) else 1 + floor(random() * array_length(v_kategorier, 1))::int end;
    insert into public.bode (bodekasse_id, saeson_id, batch_id, giver_id, modtager_id, bodekategori_id, pris, givet)
    values (v_kasse, v_gammel, gen_random_uuid(), v_giver, v_modtager, v_kategorier[v_k], v_priser[v_k],
            now() - interval '58 weeks' + make_interval(days => floor(random() * 250)::int, hours => floor(random() * 24)::int));
  end loop;

  raise notice 'Statistik demo data added to FC Ølhunde.';
end $$;
