-- Filing an Anke (#63): only the receiver, within the box's window, once per
-- Bøde, while a Sæson runs and the rule is on. The server draws a whole-krone
-- Gebyr uniformly between the minimum and max multiple × the kept price. The
-- Bøde then counts for nobody until a verdict; the Gebyr counts at once.
begin;
\ir _hjaelpere.psql
select plan(23);

select tests.opret_bodekasse() as kasse \gset
select tests.opret_medlem_med_login(:'kasse', 'Anna', true) as anna \gset
select tests.opret_medlem_med_login(:'kasse', 'Bo') as bo \gset
select tests.opret_medlem_med_login(:'kasse', 'Carl') as carl \gset
select tests.opret_bodekategori(:'anna', 'For sent', 50) as for_sent \gset

-- The rule is off by default.
select tests.giv_bode(:'bo', :'carl', p_kategori => :'for_sent') as b1 \gset
select tests.log_ind_som_medlem(:'carl');
select throws_ok(
  format($$ select public.indgiv_anke(gen_random_uuid(), %L) $$, :'b1'),
  'P0001', 'anke_slaaet_fra', 'no Anke while the rule is off (the default)');

-- An Admin turns it on through Indstillinger, with the default settings.
select tests.log_ind_som_medlem(:'anna');
select public.opdater_indstillinger(gen_random_uuid(), :'kasse', '{"anke_til": true}');
select results_eq(
  format($$ select anke_til, anke_vindue_timer, anke_min, anke_max_gange::float8
              from public.bodekasse where id = %L $$, :'kasse'),
  $$ values (true, 24, 1, 2::float8) $$,
  'Admins turn Anke on; defaults: 24 h window, 1 kr minimum, 2× the Bøde');

-- Only the receiver may appeal.
select tests.log_ind_som_medlem(:'bo');
select throws_ok(
  format($$ select public.indgiv_anke(gen_random_uuid(), %L) $$, :'b1'),
  '42501', 'ikke_modtager', 'the giver cannot appeal');
select tests.log_ind_som_medlem(:'anna');
select throws_ok(
  format($$ select public.indgiv_anke(gen_random_uuid(), %L) $$, :'b1'),
  '42501', 'ikke_modtager', 'nobody else (not even an Admin) can appeal');

-- Carl appeals.
select tests.log_ind_som_medlem(:'carl');
select public.indgiv_anke(gen_random_uuid(), :'b1') as svar \gset
select ok((:'svar'::jsonb ->> 'gebyr')::int between 1 and 100
          and (:'svar'::jsonb ->> 'min')::int = 1 and (:'svar'::jsonb ->> 'max')::int = 100,
  'the answer has the drawn Gebyr and the range it was drawn from (1–100 kr for a 50 kr Bøde)');

select results_eq(
  format($$ select a.bode_id, a.afgoerelse::text, g.medlem_id, g.art::text, g.beloeb
              from public.anke a join public.gebyr g on g.anke_id = a.id
             where a.id = %L $$, :'svar'::jsonb ->> 'anke_id'),
  format($$ values (%L::uuid, null::text, %L::uuid, 'anke', %s) $$,
         :'b1', :'carl', :'svar'::jsonb ->> 'gebyr'),
  'it creates a pending Anke and an Anke Gebyr the receiver pays');

select results_eq(
  format($$ select anket, baerer_id from public.bode_baerer where id = %L $$, :'b1'),
  $$ values (true, null::uuid) $$,
  'the Bøde is Anket and borne by nobody');

select results_eq(
  format($$ select (select saldo from public.medlem_saldo where medlem_id = %L),
                   (select saldo from public.medlem_saldo where medlem_id = %L),
                   (select boeder_i_alt from public.medlem_saeson_tal where medlem_id = %L) $$,
         :'carl', :'bo', :'carl'),
  format($$ values (%1$s, 0, %1$s) $$, :'svar'::jsonb ->> 'gebyr'),
  'Saldo and Bøder i alt leave out the Bøde but include the Anke Gebyr');

select results_eq(
  $$ select aktoer_id, modtager_id, ref_tabel, data->>'bode_id', data->>'navn', (data->>'pris')::int
       from public.haendelse where art = 'anke_indgivet' $$,
  format($$ values (%L::uuid, %L::uuid, 'anke', %L, 'For sent', 50) $$, :'carl', :'bo', :'b1'),
  'the feed gets an anke_indgivet entry by the receiver, about the giver, pointing at the Anke');

select results_eq(
  format($$ select (g ->> 'beloeb')::int, g ->> 'art' from public.aktivitet a,
                   jsonb_array_elements(a.gebyrer) g where a.art = 'anke_indgivet' $$),
  format($$ values (%s, 'anke') $$, :'svar'::jsonb ->> 'gebyr'),
  'the Anke Gebyr shows on the feed entry');

-- Once per Bøde, ever; a retry with the same one-time ID returns the first answer.
select throws_ok(
  format($$ select public.indgiv_anke(gen_random_uuid(), %L) $$, :'b1'),
  'P0001', 'anke_findes', 'a Bøde can be appealed only once');

select tests.giv_bode(:'bo', :'carl', p_kategori => :'for_sent') as b2 \gset
select tests.log_ind_som_medlem(:'carl');
select gen_random_uuid() as gentag \gset
select public.indgiv_anke(:'gentag', :'b2') as svar2 \gset
select is(public.indgiv_anke(:'gentag', :'b2'), :'svar2'::jsonb,
  'a repeat with the same one-time ID returns the first answer (no second Gebyr)');

-- The window: 24 h from when the Bøde was given, by the settings at filing time.
select tests.giv_bode(:'bo', :'carl', p_kategori => :'for_sent') as b3 \gset
select tests.log_ud();
update public.bode set givet = now() - interval '25 hours' where id = :'b3';
select tests.log_ind_som_medlem(:'carl');
select throws_ok(
  format($$ select public.indgiv_anke(gen_random_uuid(), %L) $$, :'b3'),
  'P0001', 'anke_frist_udloebet', 'no Anke after the window');

select tests.log_ind_som_medlem(:'anna');
select public.opdater_indstillinger(gen_random_uuid(), :'kasse', '{"anke_vindue_timer": 48}');
select tests.log_ind_som_medlem(:'carl');
select lives_ok(
  format($$ select public.indgiv_anke(gen_random_uuid(), %L) $$, :'b3'),
  'a longer window applies to Anker filed afterwards');

-- Gebyr bounds follow the settings of the moment.
select tests.log_ind_som_medlem(:'anna');
select public.opdater_indstillinger(gen_random_uuid(), :'kasse',
  '{"anke_min": 30, "anke_max_gange": 1}');
select tests.giv_bode(:'bo', :'carl', 40) as b4 \gset
select tests.log_ind_som_medlem(:'carl');
select public.indgiv_anke(gen_random_uuid(), :'b4') as svar4 \gset
select ok((:'svar4'::jsonb ->> 'gebyr')::int between 30 and 40
          and (:'svar4'::jsonb ->> 'min')::int = 30 and (:'svar4'::jsonb ->> 'max')::int = 40,
  'a changed minimum and multiple apply to later Anker (30–40 kr for a 40 kr Bøde at 1×)');

select tests.giv_bode(:'bo', :'carl', 20) as b5 \gset
select tests.log_ind_som_medlem(:'carl');
select results_eq(
  format($$ select (s ->> 'gebyr')::int, (s ->> 'min')::int, (s ->> 'max')::int
              from public.indgiv_anke(gen_random_uuid(), %L) s $$, :'b5'),
  $$ values (30, 30, 30) $$,
  'when the multiple gives less than the minimum, the Gebyr is the minimum');

select tests.log_ind_som_medlem(:'anna');
select public.opdater_indstillinger(gen_random_uuid(), :'kasse',
  '{"anke_min": 1, "anke_max_gange": 1.5}');
select tests.giv_bode(:'bo', :'carl', 25) as b6 \gset
select tests.log_ind_som_medlem(:'carl');
select is((public.indgiv_anke(gen_random_uuid(), :'b6') ->> 'max')::int, 37,
  'the top of the range is rounded down to whole kroner (1.5 × 25 kr = 37 kr)');

-- The draw is uniform: 300 Anker on 50 kr Bøder spread over the whole 1–100 range.
select tests.log_ind_som_medlem(:'anna');
select public.opdater_indstillinger(gen_random_uuid(), :'kasse',
  '{"anke_min": 1, "anke_max_gange": 2}');
select tests.log_ud();
create temp table traek (beloeb int) on commit drop;
grant insert, select on traek to authenticated;
select tests.log_ind_som_medlem(:'carl');
do $$
declare i int;
begin
  for i in 1..300 loop
    insert into traek
    select (public.indgiv_anke(gen_random_uuid(),
              tests.giv_bode(m.bo, m.carl)) ->> 'gebyr')::int
      from (select (select id from public.medlem where navn = 'Bo')   as bo,
                   (select id from public.medlem where navn = 'Carl') as carl) m;
  end loop;
end $$;
select results_eq(
  $$ select min(beloeb) between 1 and 15, max(beloeb) between 86 and 100,
            count(*) filter (where beloeb <= 50) between 100 and 200,
            bool_and(beloeb between 1 and 100)
       from traek $$,
  $$ values (true, true, true, true) $$,
  'the Gebyr is a whole krone amount spread evenly between 1 and 100 kr');

-- Not on an annulled Bøde, not in a Pause, not on an earlier Sæson's Bøde.
select tests.giv_bode(:'bo', :'carl', p_kategori => :'for_sent') as b7 \gset
select tests.log_ind_som_medlem(:'anna');
select public.annuller_bode(gen_random_uuid(), :'b7');
select tests.log_ind_som_medlem(:'carl');
select throws_ok(
  format($$ select public.indgiv_anke(gen_random_uuid(), %L) $$, :'b7'),
  'P0001', 'allerede_annulleret', 'an annulled Bøde cannot be appealed');

select throws_ok(
  format($$ select public.indgiv_anke(gen_random_uuid(), %L) $$, gen_random_uuid()),
  'P0001', 'ikke_fundet', 'an unknown Bøde is not found');

select tests.giv_bode(:'bo', :'carl', p_kategori => :'for_sent') as b8 \gset
select tests.log_ind_som_medlem(:'anna');
select public.afslut_saeson(gen_random_uuid(), :'kasse');
select tests.log_ind_som_medlem(:'carl');
select throws_ok(
  format($$ select public.indgiv_anke(gen_random_uuid(), %L) $$, :'b8'),
  'P0001', 'pause', 'no Anke in a Pause');

select tests.log_ind_som_medlem(:'anna');
select public.start_saeson(gen_random_uuid(), :'kasse');
select tests.log_ind_som_medlem(:'carl');
select throws_ok(
  format($$ select public.indgiv_anke(gen_random_uuid(), %L) $$, :'b8'),
  'P0001', 'tidligere_saeson', 'no Anke on a Bøde from an earlier Sæson');

-- Another box's Bøde is invisible.
select tests.opret_bodekasse('Anden') as kasse2 \gset
select tests.opret_medlem_med_login(:'kasse2', 'Dina') as dina \gset
select tests.opret_medlem_med_login(:'kasse2', 'Eva') as eva \gset
select tests.giv_bode(:'dina', :'eva') as b9 \gset
select tests.log_ind_som_medlem(:'carl');
select throws_ok(
  format($$ select public.indgiv_anke(gen_random_uuid(), %L) $$, :'b9'),
  '42501', 'ikke_medlem', 'a Bøde in another box cannot be appealed');

select * from finish();
rollback;
