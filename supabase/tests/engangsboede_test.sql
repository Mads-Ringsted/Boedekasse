-- Engangsbøde: a Giv bøder line with a free-text reason and an amount instead
-- of a Bødekategori. The giver pays the Engangsbøde Gebyr when it is on.
begin;
\ir _hjaelpere.psql
select plan(18);

select tests.opret_bodekasse('Kasse A') as kasse \gset
select tests.opret_medlem_med_login(:'kasse', 'Mads', true) as admin \gset
select tests.opret_medlem_med_login(:'kasse', 'Jonas') as jonas \gset
select tests.opret_medlem_med_login(:'kasse', 'Emil') as emil \gset

-- One Engangsbøde line.
create function tests.engangs(p_modtager uuid, p_grund text, p_beloeb int)
returns jsonb language sql as $$
  select jsonb_build_object('modtager_id', p_modtager, 'grund', p_grund, 'beloeb', p_beloeb)
$$;
grant execute on function tests.engangs(uuid, text, int) to authenticated;

-- ---------- On (the default: 10 kr) ----------
select tests.log_ind_som_medlem(:'jonas');
select public.giv_boeder(gen_random_uuid(), :'kasse', jsonb_build_array(
  tests.engangs(:'emil', '  Kom for sent til bryllup ', 100))) as svar \gset
select (:'svar'::jsonb ->> 'batch_id')::uuid as batch \gset

select results_eq(
  format($$ select modtager_id, giver_id, bodekategori_id, grund, pris from public.bode
             where batch_id = %L $$, :'batch'),
  format($$ values (%L::uuid, %L::uuid, null::uuid, 'Kom for sent til bryllup', 100) $$, :'emil', :'jonas'),
  'an Engangsbøde is a Bøde with the trimmed reason and amount and no Bødekategori');

select results_eq(
  format($$ select medlem_id, art::text, beloeb, bode_id, saeson_id from public.gebyr
             where bodekasse_id = %L $$, :'kasse'),
  format($$ select %L::uuid, 'engangsbode', 10, b.id, s.aktiv_saeson_id
              from public.bode b, public.bodekasse_saeson s
             where b.batch_id = %L and s.bodekasse_id = %L $$, :'jonas', :'batch', :'kasse'),
  'with the Gebyr on, the giver pays 10 kr for that Engangsbøde in the running Sæson');

select is(:'svar'::jsonb - 'batch_id', '{"antal": 1, "beloeb": 100}'::jsonb,
  'the answer counts the Engangsbøde, not the Gebyr');

select results_eq(
  format($$ select medlem_id, saldo from public.medlem_saldo
             where bodekasse_id = %L and saldo <> 0 order by saldo $$, :'kasse'),
  format($$ values (%L::uuid, 10), (%L::uuid, 100) $$, :'jonas', :'emil'),
  'the Bøde counts for the receiver and the Gebyr for the giver');

select results_eq(
  format($$ select m.medlem_id, m.boeder_i_alt from public.medlem_saeson_tal m
              join public.saeson_status s on s.id = m.saeson_id and s.er_seneste
             where m.bodekasse_id = %L and m.boeder_i_alt <> 0 order by 2 $$, :'kasse'),
  format($$ values (%L::uuid, 10), (%L::uuid, 100) $$, :'jonas', :'emil'),
  'both count in Bøder i alt this Sæson');

select results_eq(
  format($$ select data, jsonb_path_query_array(boeder, '$[*].gebyr'),
                   jsonb_path_query_array(boeder, '$[*].engangsbode')
              from public.aktivitet where batch_id = %L $$, :'batch'),
  format($$ values (jsonb_build_object('antal', 1, 'beloeb', 100, 'linjer', jsonb_build_array(
                      jsonb_build_object('navn', 'Kom for sent til bryllup', 'pris', 100, 'antal', 1,
                                         'bodekategori_id', null))),
                    '[10]'::jsonb, '[true]'::jsonb) $$),
  'the feed row has the reason, the amount and the Gebyr');

-- Fortryd removes the Engangsbøde and its Gebyr.
select public.fortryd_batch(gen_random_uuid(), :'batch');
select is((select count(*)::int from public.gebyr where bodekasse_id = :'kasse'), 0,
  'Fortryd removes the Engangsbøde''s Gebyr too');

-- Mixed with a Bødekategori in one submit.
select tests.opret_bodekategori(:'jonas', 'For sent', 50) as for_sent \gset
select public.giv_boeder(gen_random_uuid(), :'kasse', jsonb_build_array(
  jsonb_build_object('modtager_id', :'emil', 'bodekategori_id', :'for_sent', 'antal', 1),
  tests.engangs(:'emil', 'Glemte nøglerne', 30),
  tests.engangs(:'admin', 'Glemte nøglerne', 30))) as blandet \gset
select is(:'blandet'::jsonb - 'batch_id', '{"antal": 3, "beloeb": 110}'::jsonb,
  'Engangsbøder and Bødekategorier go in one submit');
select is((select sum(beloeb)::int from public.gebyr where medlem_id = :'jonas'), 20,
  'one Gebyr per Engangsbøde');

-- ---------- Rules ----------
select throws_ok(
  format($$ select public.giv_boeder(gen_random_uuid(), %L, jsonb_build_array(tests.engangs(%L, '   ', 100))) $$,
         :'kasse', :'emil'),
  'P0001', 'grund_mangler', 'an Engangsbøde needs a reason');
select throws_ok(
  format($$ select public.giv_boeder(gen_random_uuid(), %L,
            jsonb_build_array(jsonb_build_object('modtager_id', %L, 'grund', null, 'beloeb', 100))) $$,
         :'kasse', :'emil'),
  'P0001', 'grund_mangler', 'a null reason is no reason');
select throws_ok(
  format($$ select public.giv_boeder(gen_random_uuid(), %L, jsonb_build_array(tests.engangs(%L, repeat('x', 101), 100))) $$,
         :'kasse', :'emil'),
  'P0001', 'grund_for_lang', 'a reason is at most 100 characters');
select throws_ok(
  format($$ select public.giv_boeder(gen_random_uuid(), %L, jsonb_build_array(tests.engangs(%L, 'Hvorfor', 0))) $$,
         :'kasse', :'emil'),
  'P0001', 'beloeb_ugyldig', 'the amount must be above 0');
select throws_ok(
  format($$ select public.giv_boeder(gen_random_uuid(), %L,
            jsonb_build_array(jsonb_build_object('modtager_id', %L, 'grund', 'Hvorfor', 'beloeb', 12.5))) $$,
         :'kasse', :'emil'),
  'P0001', 'beloeb_ugyldig', 'the amount is whole kroner');
select throws_ok(
  format($$ select public.giv_boeder(gen_random_uuid(), %L, jsonb_build_array(tests.engangs(%L, 'Hvorfor', 10))) $$,
         :'kasse', :'jonas'),
  'P0001', 'ikke_dig_selv', 'you can''t give yourself an Engangsbøde');

-- ---------- Off ----------
select tests.log_ind_som_medlem(:'admin');
select public.opdater_indstillinger(gen_random_uuid(), :'kasse',
  '{"engangsgebyr_til": false, "engangsgebyr": 15}');
select results_eq(
  format($$ select engangsgebyr_til, engangsgebyr from public.bodekasse where id = %L $$, :'kasse'),
  $$ values (false, 15) $$,
  'an Admin can switch the Engangsbøde Gebyr and set its amount');

select public.giv_boeder(gen_random_uuid(), :'kasse', jsonb_build_array(
  tests.engangs(:'emil', 'Gratis', 40))) as gratis \gset
select is(
  (select count(*)::int from public.gebyr g join public.bode b on b.id = g.bode_id
    where b.batch_id = (:'gratis'::jsonb ->> 'batch_id')::uuid),
  0, 'with the Gebyr off, an Engangsbøde costs the giver nothing');

-- ---------- Pause ----------
select tests.log_ud();
update public.saeson set afsluttet = now() where bodekasse_id = :'kasse';
select tests.log_ind_som_medlem(:'jonas');
select throws_ok(
  format($$ select public.giv_boeder(gen_random_uuid(), %L, jsonb_build_array(tests.engangs(%L, 'Hvorfor', 10))) $$,
         :'kasse', :'emil'),
  'P0001', 'pause', 'no Engangsbøde in a Pause');

select * from finish();
rollback;
