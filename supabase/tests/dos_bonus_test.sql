-- Dos-bonus (#77): an automatic Gebyr for receiving two Bøder from the same
-- Bødekategori on the same day (06:00 to 06:00 Copenhagen). One per full
-- pair; the day's Dos-bonuses pair up again the same way. Worked out again
-- whenever the Bøder a Medlem bears that day change: giving Bøder, annulling
-- a Bøde, an Anke verdict that moves a Bøde, and Fortryd.
begin;
\ir _hjaelpere.psql
select plan(43);

select tests.opret_bodekasse() as kasse \gset
select tests.opret_medlem_med_login(:'kasse', 'Anna', true) as anna \gset
select tests.opret_medlem_med_login(:'kasse', 'Bo') as bo \gset
select tests.opret_medlem_med_login(:'kasse', 'Carl') as carl \gset
select tests.opret_medlem_med_login(:'kasse', 'Dan') as dan \gset
select tests.opret_medlem_med_login(:'kasse', 'Eva') as eva \gset
select tests.opret_medlem_med_login(:'kasse', 'Fie') as fie \gset
select tests.opret_medlem_med_login(:'kasse', 'Gus') as gus \gset
select tests.opret_medlem_med_login(:'kasse', 'Hans') as hans \gset
select tests.opret_medlem_med_login(:'kasse', 'Ida') as ida \gset
select tests.opret_medlem_med_login(:'kasse', 'Jens') as jens \gset
select tests.opret_medlem_med_login(:'kasse', 'Kim') as kim \gset
select tests.opret_medlem_med_login(:'kasse', 'Lis') as lis \gset
select tests.opret_medlem_med_login(:'kasse', 'Ole') as ole \gset
select tests.opret_medlem_med_login(:'kasse', 'Pia') as pia \gset
select tests.opret_medlem_med_login(:'kasse', 'Sara') as sara \gset
select tests.opret_medlem_med_login(:'kasse', 'Tom') as tom \gset
select tests.opret_medlem_med_login(:'kasse', 'Vera') as vera \gset
select tests.opret_medlem_med_login(:'kasse', 'Wil') as wil \gset
select tests.opret_bodekategori(:'anna', 'For sent', 50) as for_sent \gset
select tests.opret_bodekategori(:'anna', 'Øl', 30) as oel \gset
select tests.opret_bodekategori(:'anna', 'Tale', 20) as tale \gset
select tests.opret_bodekategori(:'anna', 'Sko', 10) as sko \gset

-- Dos-bonus rows for one Medlem: (not annulled, annulled).
create function tests.dos(p_medlem uuid) returns table (aktive int, annullerede int)
language sql security definer as $$
  select count(*) filter (where annulleret is null)::int,
         count(*) filter (where annulleret is not null)::int
    from public.gebyr where medlem_id = p_medlem and art = 'dos_bonus'
$$;
grant execute on function tests.dos(uuid) to authenticated;

-- Bo gives p_modtager the Bøder in p_linjer ([[kategori, antal], ...]).
create function tests.giv(p_modtager uuid, p_linjer jsonb, p_klient uuid default gen_random_uuid())
returns jsonb language sql as $$
  select public.giv_boeder(p_klient, (select bodekasse_id from public.medlem where id = p_modtager),
    (select jsonb_agg(jsonb_build_object('modtager_id', p_modtager, 'bodekategori_id', l ->> 0,
                                         'antal', (l ->> 1)::int))
       from jsonb_array_elements(p_linjer) l))
$$;
grant execute on function tests.giv(uuid, jsonb, uuid) to authenticated;

-- ---------- Off by default ----------
select results_eq(
  format($$ select dos_bonus_til, dos_bonus_beloeb from public.bodekasse where id = %L $$, :'kasse'),
  $$ values (false, 10) $$,
  'a box starts with Dos-bonus off, at 10 kr');

select tests.log_ind_som_medlem(:'bo');
select tests.giv(:'carl', format('[["%s", 2]]', :'for_sent')::jsonb);
select results_eq(format($$ select * from tests.dos(%L) $$, :'carl'), $$ values (0, 0) $$,
  'with the rule off, a pair gives no Dos-bonus');

-- ---------- The rule on ----------
select tests.log_ind_som_medlem(:'bo');
select throws_ok(
  format($$ select public.opdater_indstillinger(gen_random_uuid(), %L, '{"dos_bonus_til": true}') $$, :'kasse'),
  '42501', 'ikke_admin', 'only an Admin switches Dos-bonus on');
select tests.log_ind_som_medlem(:'anna');
select throws_ok(
  format($$ select public.opdater_indstillinger(gen_random_uuid(), %L, '{"dos_bonus_beloeb": 0}') $$, :'kasse'),
  'P0001', 'indstilling_ugyldig', 'the amount is above 0');
select public.opdater_indstillinger(gen_random_uuid(), :'kasse', '{"dos_bonus_til": true, "dos_bonus_beloeb": 10}');

select tests.log_ind_som_medlem(:'bo');
select tests.giv(:'dan', format('[["%s", 2]]', :'for_sent')::jsonb);
select tests.log_ud();
select results_eq(
  format($$ select art::text, beloeb, saeson_id = private.aktiv_saeson(%L),
                   udloeser = ((now() at time zone 'Europe/Copenhagen') - interval '6 hours')::date
              from public.gebyr where medlem_id = %L and art = 'dos_bonus' $$, :'kasse', :'dan'),
  $$ values ('dos_bonus', 10, true, true) $$,
  'two Bøder from one Bødekategori on one day give one Dos-bonus, in the running Sæson, for that day');
select results_eq(
  format($$ select saldo from public.medlem_saldo where medlem_id = %L $$, :'dan'),
  $$ values (110) $$,
  'the Dos-bonus counts in Saldo (2 × 50 + 10)');

-- The giver isn't charged.
select results_eq(format($$ select * from tests.dos(%L) $$, :'bo'), $$ values (0, 0) $$,
  'the giver pays no Dos-bonus');

-- A third Bøde from another Bødekategori recomputes the day: still one.
select tests.log_ind_som_medlem(:'bo');
select tests.giv(:'dan', format('[["%s", 1]]', :'oel')::jsonb);
select results_eq(format($$ select * from tests.dos(%L) $$, :'dan'), $$ values (1, 0) $$,
  'recomputing the same day again changes nothing');

-- Two separate gives make a pair too.
select tests.giv(:'eva', format('[["%s", 1]]', :'oel')::jsonb);
select tests.giv(:'eva', format('[["%s", 1]]', :'oel')::jsonb);
select results_eq(format($$ select * from tests.dos(%L) $$, :'eva'), $$ values (1, 0) $$,
  'a pair across two gives counts too');

-- ---------- How many ----------
select tests.log_ind_som_medlem(:'bo');
select tests.giv(:'fie', format('[["%s", 3]]', :'for_sent')::jsonb);
select results_eq(format($$ select * from tests.dos(%L) $$, :'fie'), $$ values (1, 0) $$,
  'three of a kind is one full pair: one Dos-bonus');

select tests.giv(:'gus', format('[["%s", 4]]', :'for_sent')::jsonb);
select results_eq(format($$ select * from tests.dos(%L) $$, :'gus'), $$ values (3, 0) $$,
  'four of a kind: two pairs, and those two Dos-bonuses pair up once more (2 + 1)');

select tests.giv(:'hans', format('[["%s", 2], ["%s", 2], ["%s", 2], ["%s", 2]]',
                                 :'for_sent', :'oel', :'tale', :'sko')::jsonb);
select results_eq(format($$ select * from tests.dos(%L) $$, :'hans'), $$ values (7, 0) $$,
  'two of a kind in four Bødekategorier: 4 + 2 + 1 = 7 Dos-bonuses');
select tests.log_ud();
select results_eq(
  format($$ select array_agg(dos_nr order by dos_nr), sum(beloeb)::int
              from public.gebyr where medlem_id = %L and art = 'dos_bonus' $$, :'hans'),
  $$ values ('{1,2,3,4,5,6,7}'::int[], 70) $$,
  'each Dos-bonus of the day has its own sequence number');

-- Engangsbøder and Gebyrer don't count.
select tests.log_ind_som_medlem(:'bo');
select public.giv_boeder(gen_random_uuid(), :'kasse', jsonb_build_array(
  jsonb_build_object('modtager_id', :'ida', 'grund', 'Sang', 'beloeb', 20),
  jsonb_build_object('modtager_id', :'ida', 'grund', 'Sang', 'beloeb', 20),
  jsonb_build_object('modtager_id', :'ida', 'bodekategori_id', :'oel', 'antal', 1)));
select results_eq(format($$ select * from tests.dos(%L) $$, :'ida'), $$ values (0, 0) $$,
  'Engangsbøder never count towards a Dos-bonus');
select results_eq(format($$ select * from tests.dos(%L) $$, :'bo'), $$ values (0, 0) $$,
  'nor does the Engangsbøde Gebyr the giver pays');

-- ---------- The 06:00 day ----------
select tests.log_ud();
select private.dos_bonus_dag(now()) as d \gset
select tests.giv_bode(:'bo', :'jens', p_kategori => :'oel') as j1 \gset
select tests.giv_bode(:'bo', :'jens', p_kategori => :'oel') as j2 \gset
update public.bode set givet = (:'d'::date + time '23:30') at time zone 'Europe/Copenhagen' where id = :'j1';
update public.bode set givet = (:'d'::date + 1 + time '02:00') at time zone 'Europe/Copenhagen' where id = :'j2';
select tests.log_ind_som_medlem(:'bo');
select tests.giv(:'jens', format('[["%s", 1]]', :'tale')::jsonb);
select results_eq(
  format($$ select count(*)::int, min(udloeser) from public.gebyr where medlem_id = %L and art = 'dos_bonus' $$, :'jens'),
  format($$ values (1, %L::date) $$, :'d'),
  'Bøder at 23:30 and 02:00 the night after are the same day');

select tests.log_ud();
select tests.giv_bode(:'bo', :'kim', p_kategori => :'for_sent') as k1 \gset
update public.bode set givet = (:'d'::date + time '05:59') at time zone 'Europe/Copenhagen' where id = :'k1';
select tests.log_ind_som_medlem(:'bo');
select tests.giv(:'kim', format('[["%s", 1]]', :'for_sent')::jsonb);
select results_eq(format($$ select * from tests.dos(%L) $$, :'kim'), $$ values (0, 0) $$,
  'a Bøde at 05:59 belongs to the day before');
select tests.log_ud();
select tests.giv_bode(:'bo', :'kim', p_kategori => :'for_sent') as k2 \gset
update public.bode set givet = (:'d'::date + time '06:00') at time zone 'Europe/Copenhagen' where id = :'k2';
select tests.log_ind_som_medlem(:'bo');
select tests.giv(:'kim', format('[["%s", 1]]', :'oel')::jsonb);
select results_eq(format($$ select * from tests.dos(%L) $$, :'kim'), $$ values (1, 0) $$,
  'a Bøde at 06:00 starts the new day');

-- ---------- The feed ----------
select tests.log_ind_som_medlem(:'dan');
select results_eq(
  format($$ select aktoer_id, modtager_id, ref_tabel, data->>'dag', (data->>'beloeb')::int, data->'kategorier'
              from public.haendelse where art = 'dos_bonus' and modtager_id = %L $$, :'dan'),
  format($$ values (null::uuid, %L::uuid, 'gebyr', %L, 10, '["For sent"]'::jsonb) $$, :'dan', :'d'),
  'one feed entry per Dos-bonus, by the box itself, naming the day and the Bødekategori');
select ok(
  (select bool_and(data->'kategorier' @> '["For sent", "Øl", "Tale", "Sko"]'
                   and jsonb_array_length(data->'kategorier') = 4)
     from public.haendelse where art = 'dos_bonus' and modtager_id = :'hans')
  and (select count(*) = 7 from public.haendelse where art = 'dos_bonus' and modtager_id = :'hans'),
  'every one of the day''s Dos-bonuses names all its paired Bødekategorier');
select ok(
  (select involverede @> array[:'dan']::uuid[] and annulleret is null
     from public.aktivitet where art = 'dos_bonus' and modtager_id = :'dan'),
  'it shows in the payer''s history');

-- ---------- Annulling a Bøde ----------
select tests.log_ind_som_medlem(:'anna');
select public.annuller_bode(gen_random_uuid(),
  (select id from public.bode where modtager_id = :'dan' and bodekategori_id = :'for_sent' limit 1));
select results_eq(format($$ select * from tests.dos(%L) $$, :'dan'), $$ values (0, 1) $$,
  'annulling a Bøde that made the pair annuls the Dos-bonus (the row stays)');
select tests.log_ud();
select results_eq(
  format($$ select annulleret_af, (select saldo from public.medlem_saldo where medlem_id = %L)
              from public.gebyr where medlem_id = %L and art = 'dos_bonus' $$, :'dan', :'dan'),
  format($$ values (%L::uuid, 80) $$, :'anna'),
  'it is annulled by whoever annulled the Bøde, and leaves Saldo (50 + 30)');
select ok(
  (select annulleret is not null and annulleret_af_navn = 'Anna'
     from public.aktivitet where art = 'dos_bonus' and modtager_id = :'dan'),
  'its feed entry shows struck through');

select tests.log_ind_som_medlem(:'anna');
select public.annuller_bode(gen_random_uuid(),
  (select id from public.bode where modtager_id = :'gus' limit 1));
select results_eq(format($$ select * from tests.dos(%L) $$, :'gus'), $$ values (1, 2) $$,
  'four down to three: one pair left, the stacked surplus is annulled');
select tests.log_ud();
select results_eq(
  format($$ select dos_nr from public.gebyr where medlem_id = %L and art = 'dos_bonus' and annulleret is null $$, :'gus'),
  $$ values (1) $$,
  'the newest Dos-bonuses go first');

select tests.log_ind_som_medlem(:'anna');
select throws_ok(
  format($$ select public.annuller_gebyr(gen_random_uuid(), %L) $$,
         (select id from public.gebyr where medlem_id = :'gus' and art = 'dos_bonus' and annulleret is null)),
  'P0001', 'kan_ikke_annulleres', 'a Dos-bonus goes with its pair: it can''t be annulled on its own');

-- ---------- Anke ----------
select tests.log_ind_som_medlem(:'anna');
select public.opdater_indstillinger(gen_random_uuid(), :'kasse', '{"anke_til": true}');
select tests.log_ind_som_medlem(:'bo');
select tests.giv(:'lis', format('[["%s", 2]]', :'for_sent')::jsonb);
select tests.log_ind_som_medlem(:'carl');
select tests.giv(:'bo', format('[["%s", 1]]', :'for_sent')::jsonb);
select results_eq(format($$ select * from tests.dos(%L) $$, :'bo'), $$ values (0, 0) $$,
  'one Bøde of a kind is no pair');

select tests.log_ind_som_medlem(:'lis');
select public.indgiv_anke(gen_random_uuid(),
  (select id from public.bode where modtager_id = :'lis' limit 1)) ->> 'anke_id' as anke_lis \gset
select results_eq(format($$ select * from tests.dos(%L) $$, :'lis'), $$ values (1, 0) $$,
  'filing an Anke changes nothing: the Bøde still counts for its receiver');

select tests.log_ind_som_medlem(:'dan');
select public.afgoer_anke(gen_random_uuid(), :'anke_lis', 'modtager_vandt');
select results_eq(format($$ select * from tests.dos(%L) $$, :'lis'), $$ values (0, 1) $$,
  'a won Anke moves the Bøde: the receiver''s pair is broken');
select results_eq(format($$ select * from tests.dos(%L) $$, :'bo'), $$ values (1, 0) $$,
  'and the giver now bears two of a kind: the giver pays a Dos-bonus');
select ok(
  (select annulleret_af = :'dan' from public.gebyr where medlem_id = :'lis' and art = 'dos_bonus'),
  'the receiver''s Dos-bonus is annulled by the one who recorded the verdict');

select public.aendr_afgoerelse(gen_random_uuid(), :'anke_lis', 'giver_vandt');
select results_eq(format($$ select * from tests.dos(%L) $$, :'lis'), $$ values (1, 1) $$,
  'changing the verdict back gives the receiver a new Dos-bonus');
select results_eq(format($$ select * from tests.dos(%L) $$, :'bo'), $$ values (0, 1) $$,
  'and annuls the giver''s');
select tests.log_ud();
select results_eq(
  format($$ select array_agg(dos_nr order by dos_nr) from public.gebyr where medlem_id = %L and art = 'dos_bonus' $$, :'lis'),
  $$ values ('{1,2}'::int[]) $$,
  'an annulled Dos-bonus keeps its sequence number; the new one takes the next');

-- ---------- Only active Medlemmer ----------
select tests.log_ind_som_medlem(:'carl');
select tests.giv(:'ole', format('[["%s", 1]]', :'for_sent')::jsonb);
select tests.log_ind_som_medlem(:'ole');
select tests.giv(:'pia', format('[["%s", 1]]', :'for_sent')::jsonb);
select tests.log_ind_som_medlem(:'pia');
select public.indgiv_anke(gen_random_uuid(),
  (select id from public.bode where modtager_id = :'pia')) ->> 'anke_id' as anke_pia \gset
select tests.log_ind_som_medlem(:'anna');
select public.udmeld(gen_random_uuid(), :'kasse', :'ole');
select tests.log_ind_som_medlem(:'dan');
select public.afgoer_anke(gen_random_uuid(), :'anke_pia', 'modtager_vandt');
select results_eq(format($$ select * from tests.dos(%L) $$, :'ole'), $$ values (0, 0) $$,
  'an Udmeldt Medlem gets no Dos-bonus, even bearing a pair');

-- ---------- Fortryd ----------
select tests.log_ind_som_medlem(:'bo');
select tests.giv(:'sara', format('[["%s", 2]]', :'for_sent')::jsonb) ->> 'batch_id' as batch_sara \gset
select results_eq(format($$ select * from tests.dos(%L) $$, :'sara'), $$ values (1, 0) $$,
  'Sara gets a Dos-bonus');
select public.fortryd_batch(gen_random_uuid(), :'batch_sara');
select tests.log_ud();
select results_eq(format($$ select * from tests.dos(%L) $$, :'sara'), $$ values (0, 0) $$,
  'Fortryd takes the Dos-bonus the batch charged with it');
select is(
  (select count(*)::int from public.haendelse where modtager_id = :'sara'), 0,
  'and its feed entry: Fortryd leaves no trace');

-- ---------- The amount in force ----------
select tests.log_ind_som_medlem(:'anna');
select public.opdater_indstillinger(gen_random_uuid(), :'kasse', '{"dos_bonus_beloeb": 15}');
select tests.log_ind_som_medlem(:'bo');
select tests.giv(:'tom', format('[["%s", 2]]', :'oel')::jsonb);
select tests.log_ud();
select results_eq(
  format($$ select beloeb from public.gebyr where medlem_id in (%L, %L) and art = 'dos_bonus'
             order by beloeb $$, :'eva', :'tom'),
  $$ values (10), (15) $$,
  'a Dos-bonus costs the amount in force when charged; earlier ones keep theirs');

-- ---------- Turned off ----------
select tests.log_ind_som_medlem(:'anna');
select public.opdater_indstillinger(gen_random_uuid(), :'kasse', '{"dos_bonus_til": false}');
select tests.log_ind_som_medlem(:'bo');
select tests.giv(:'tom', format('[["%s", 2]]', :'tale')::jsonb);
select results_eq(format($$ select * from tests.dos(%L) $$, :'tom'), $$ values (1, 0) $$,
  'turning the rule off stops new Dos-bonuses and keeps the old ones');
select tests.log_ind_som_medlem(:'anna');
select public.opdater_indstillinger(gen_random_uuid(), :'kasse', '{"dos_bonus_til": true}');

-- ---------- Pause ----------
select tests.log_ind_som_medlem(:'carl');
select tests.giv(:'vera', format('[["%s", 1]]', :'for_sent')::jsonb);
select tests.log_ind_som_medlem(:'vera');
select tests.giv(:'wil', format('[["%s", 1]]', :'for_sent')::jsonb);
select tests.log_ind_som_medlem(:'wil');
select public.indgiv_anke(gen_random_uuid(),
  (select id from public.bode where modtager_id = :'wil')) ->> 'anke_id' as anke_wil \gset
select tests.log_ind_som_medlem(:'anna');
select public.afslut_saeson(gen_random_uuid(), :'kasse');
select tests.log_ind_som_medlem(:'dan');
select public.afgoer_anke(gen_random_uuid(), :'anke_wil', 'modtager_vandt');
select results_eq(format($$ select * from tests.dos(%L) $$, :'vera'), $$ values (0, 0) $$,
  'no Dos-bonus arises in a Pause');

select tests.log_ind_som_medlem(:'anna');
select public.annuller_bode(gen_random_uuid(), id)
  from (select id from public.bode where modtager_id = :'fie' order by id limit 2) b;
select results_eq(format($$ select * from tests.dos(%L) $$, :'fie'), $$ values (0, 1) $$,
  'a broken pair still loses its Dos-bonus in a Pause');

select * from finish();
rollback;
