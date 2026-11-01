-- Push for automatic Gebyrer (#83): every Dos-bonus, Catch-up, Sen betaling
-- and Tilbagevendende Gebyr charged to a Medlem queues an 'automatisk_gebyr'
-- push. One scheduler run, or one action, that charges several Gebyrer to a
-- Medlem gives that Medlem one push. The recipient's toggle applies.
begin;
\ir _hjaelpere.psql
select plan(11);

-- A Bøde given at a chosen time.
create function tests.bode_givet(p_giver uuid, p_modtager uuid, p_pris int, p_givet timestamptz)
returns uuid language plpgsql as $$
declare v_id uuid := tests.giv_bode(p_giver, p_modtager, p_pris);
begin
  update public.bode set givet = p_givet where id = v_id;
  return v_id;
end $$;

-- A box whose first Sæson started on 1 January 2026.
create function tests.kasse_fra_januar(p_navn text)
returns uuid language plpgsql as $$
declare v_kasse uuid := tests.opret_bodekasse(p_navn);
begin
  update public.saeson set startet = '2026-01-01 00:00 Europe/Copenhagen' where bodekasse_id = v_kasse;
  return v_kasse;
end $$;

-- The automatic-Gebyr pushes in a box, as a test sees them.
create function tests.gebyr_push(p_kasse uuid)
returns table (navn text, titel text, tekst text, url text)
language sql security definer as $$
  select m.navn, u.titel, u.tekst, u.url
    from public.push_udbakke u
    join public.medlem m on m.user_id = u.user_id and m.bodekasse_id = u.bodekasse_id
   where u.art = 'automatisk_gebyr' and u.bodekasse_id = p_kasse
   order by u.id
$$;

-- ---------- One scheduler run: Catch-up and Tilbagevendende together ----------
-- On 1 February: Catch-up (the lowest January total pays 50) and the monthly
-- rule "Kontingent" (25 kr, day 1) for Anna, Bo and Cia. Anna and Cia gave,
-- Bo received a Bøde, so Anna and Cia tie lowest. Cia turned the push off.
select tests.kasse_fra_januar('Månedsholdet') as kasse \gset
select tests.opret_medlem_med_login(:'kasse', 'Anna', true) as anna \gset
select tests.opret_medlem_med_login(:'kasse', 'Bo') as bo \gset
select tests.opret_medlem_med_login(:'kasse', 'Cia') as cia \gset
update public.bodekasse set catch_up_til = true, catch_up_antal = 1, catch_up_beloeb = 50 where id = :'kasse';
select tests.bode_givet(:'anna', :'bo', 100, '2026-01-20 20:00 Europe/Copenhagen');
select tests.log_ind_som_medlem(:'anna');
select public.opret_tilbagevendende(gen_random_uuid(), :'kasse', 'Kontingent', 25, 'maaned', 1,
  array[:'anna', :'bo', :'cia']::uuid[]) ->> 'tilbagevendende_id' as regel \gset
select tests.log_ind_som_medlem(:'cia');
select public.saet_push_praeference('automatisk_gebyr', false);
select tests.log_ud();
update public.tilbagevendende set aendret = '2026-01-01 00:00 Europe/Copenhagen' where id = :'regel';

select private.koer_automatik('2026-02-01 00:30 Europe/Copenhagen');
select results_eq(
  format($$ select * from tests.gebyr_push(%L) order by navn $$, :'kasse'),
  format($$ values
    ('Anna', '2 nye gebyrer i Månedsholdet', 'Catch-up, Kontingent · 75 kr', '/profil?bodekasse=' || %1$L),
    ('Bo', 'Nyt gebyr i Månedsholdet', 'Kontingent · 25 kr', '/profil?bodekasse=' || %1$L) $$, :'kasse'),
  'one run that charges several Gebyrer gives one push per Medlem, naming the box; not to one who turned it off');
select is(
  (select count(*)::int from public.gebyr where medlem_id = :'cia' and art in ('catch_up', 'tilbagevendende')),
  2,
  'the Medlem with the push off is still charged');

select private.koer_automatik('2026-02-01 00:30 Europe/Copenhagen');
select private.koer_automatik('2026-02-01 01:30 Europe/Copenhagen');
select is(
  (select count(*)::int from public.push_udbakke where art = 'automatisk_gebyr' and bodekasse_id = :'kasse'),
  2,
  'running again charges nothing and pushes nothing');

-- The next month is a new run, so a new push.
select private.koer_automatik('2026-03-01 00:30 Europe/Copenhagen');
select results_eq(
  format($$ select navn, count(*)::int from tests.gebyr_push(%L) group by navn order by navn $$, :'kasse'),
  $$ values ('Anna', 2), ('Bo', 2) $$,
  'a later run that charges again pushes again');

-- ---------- Sen betaling: back-charged days in one run ----------
-- Betalingsdag 5. Dan owes 100 from January. The first run after the 5th is
-- on the 8th, and charges the 6th, 7th and 8th at once.
select tests.kasse_fra_januar('Sen holdet') as sen \gset
select tests.opret_medlem_med_login(:'sen', 'Eva', true) as eva \gset
select tests.opret_medlem_med_login(:'sen', 'Dan') as dan \gset
update public.bodekasse set sen_betaling_til = true, betalingsdag = 5, sen_betaling_beloeb = 25 where id = :'sen';
select tests.bode_givet(:'eva', :'dan', 100, '2026-01-20 20:00 Europe/Copenhagen');

select private.koer_automatik('2026-02-08 00:30 Europe/Copenhagen');
select results_eq(
  format($$ select navn, titel, tekst from tests.gebyr_push(%L) $$, :'sen'),
  $$ values ('Dan', '3 nye gebyrer i Sen holdet', 'Sen betaling ×3 · 75 kr') $$,
  'three late days charged in one run give one push');

select private.koer_automatik('2026-02-09 00:30 Europe/Copenhagen');
select results_eq(
  format($$ select navn, titel, tekst from tests.gebyr_push(%L) $$, :'sen'),
  $$ values ('Dan', '3 nye gebyrer i Sen holdet', 'Sen betaling ×3 · 75 kr'),
            ('Dan', 'Nyt gebyr i Sen holdet', 'Sen betaling · 25 kr') $$,
  'the next late day is its own push');

-- ---------- Dos-bonus: one action ----------
-- The Sæson runs now, so Bøder are given through giv_boeder with real time.
select tests.opret_bodekasse('Dosholdet') as dos \gset
select tests.opret_medlem_med_login(:'dos', 'Gro', true) as gro \gset
select tests.opret_medlem_med_login(:'dos', 'Hans') as hans \gset
select tests.opret_medlem_med_login(:'dos', 'Ida') as ida \gset
select tests.opret_bodekategori(:'gro', 'For sent', 20) as for_sent \gset
select tests.log_ind_som_medlem(:'gro');
select public.opdater_indstillinger(gen_random_uuid(), :'dos', '{"dos_bonus_til": true, "dos_bonus_beloeb": 10}');

-- Four of a kind: 2 + 1 = 3 Dos-bonuses in one Giv.
select public.giv_boeder(gen_random_uuid(), :'dos', jsonb_build_array(
  jsonb_build_object('modtager_id', :'hans', 'bodekategori_id', :'for_sent', 'antal', 4)));
select tests.log_ud();
select results_eq(
  format($$ select navn, titel, tekst from tests.gebyr_push(%L) $$, :'dos'),
  $$ values ('Hans', '3 nye gebyrer i Dosholdet', 'Dos-bonus ×3 · 30 kr') $$,
  'one Giv that charges three Dos-bonuses gives one push');
select is(
  (select send_efter from public.push_udbakke where art = 'automatisk_gebyr' and bodekasse_id = :'dos'),
  now() + private.fortryd_frist(),
  'a Dos-bonus push from a Giv waits out the Fortryd grace, like the Bøde push');

-- Annulling a Bøde breaks a pair: Dos-bonuses are annulled, nothing is pushed.
select tests.log_ind_som_medlem(:'gro');
select public.annuller_bode(gen_random_uuid(),
  (select id from public.bode where modtager_id = :'hans' order by id limit 1));
select tests.log_ud();
select is(
  (select count(*)::int from public.push_udbakke where art = 'automatisk_gebyr' and bodekasse_id = :'dos'),
  1,
  'annulling a Dos-bonus pushes nothing');

-- Fortryd takes the Dos-bonus back, and its unsent push with it.
select tests.log_ind_som_medlem(:'gro');
select public.giv_boeder(gen_random_uuid(), :'dos', jsonb_build_array(
  jsonb_build_object('modtager_id', :'ida', 'bodekategori_id', :'for_sent', 'antal', 2))) ->> 'batch_id' as batch \gset
select tests.log_ud();
select results_eq(
  format($$ select navn, tekst from tests.gebyr_push(%L) where navn = 'Ida' $$, :'dos'),
  $$ values ('Ida', 'Dos-bonus · 10 kr') $$,
  'one Dos-bonus gives one push');
select tests.log_ind_som_medlem(:'gro');
select public.fortryd_batch(gen_random_uuid(), :'batch');
select tests.log_ud();
select is_empty(
  format($$ select 1 from tests.gebyr_push(%L) where navn = 'Ida' $$, :'dos'),
  'Fortryd deletes the Dos-bonus push');

select * from finish();
rollback;
