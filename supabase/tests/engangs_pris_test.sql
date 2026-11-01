-- Engangsbøde price modes (#76): an Admin picks Fri (any amount, the
-- default), Fast (always X kr) or Loft (up to X kr). giv_boeder enforces it.
-- The Engangsbøde Gebyr is charged as before, and a change never touches
-- Bøder already given.
begin;
\ir _hjaelpere.psql
select plan(22);

select tests.opret_bodekasse('Kasse A') as kasse \gset
select tests.opret_medlem_med_login(:'kasse', 'Mads', true) as admin \gset
select tests.opret_medlem_med_login(:'kasse', 'Jonas') as jonas \gset
select tests.opret_medlem_med_login(:'kasse', 'Emil') as emil \gset

-- Gives one Engangsbøde line and returns the stored Bøde's price.
create function tests.giv_engangs(p_kasse uuid, p_linje jsonb)
returns int language plpgsql as $$
declare v_batch uuid;
begin
  v_batch := (public.giv_boeder(gen_random_uuid(), p_kasse, jsonb_build_array(p_linje)) ->> 'batch_id')::uuid;
  return (select b.pris from public.bode b where b.batch_id = v_batch);
end $$;
grant execute on function tests.giv_engangs(uuid, jsonb) to authenticated;

create function tests.indstil(p_kasse uuid, p_aendringer jsonb)
returns jsonb language sql as $$
  select public.opdater_indstillinger(gen_random_uuid(), p_kasse, p_aendringer)
$$;
grant execute on function tests.indstil(uuid, jsonb) to authenticated;

-- ---------- Defaults: Fri ----------
select results_eq(
  format($$ select engangs_pris_mode::text, engangs_pris from public.bodekasse where id = %L $$, :'kasse'),
  $$ values ('fri', null::int) $$,
  'a new box prices Engangsbøder freely, with no amount set');

select tests.log_ind_som_medlem(:'jonas');
select is(tests.giv_engangs(:'kasse', jsonb_build_object('modtager_id', :'emil', 'grund', 'Fri', 'beloeb', 777)),
  777, 'Fri: the giver''s amount is stored');

-- ---------- Settings ----------
select throws_ok(
  format($$ select tests.indstil(%L, '{"engangs_pris_mode": "fast", "engangs_pris": 30}') $$, :'kasse'),
  '42501', 'ikke_admin', 'only an Admin changes the price mode');

select tests.log_ind_som_medlem(:'admin');
select throws_ok(
  format($$ select tests.indstil(%L, '{"engangs_pris_mode": "fast"}') $$, :'kasse'),
  'P0001', 'indstilling_ugyldig', 'Fast without an amount is rejected');
select throws_ok(
  format($$ select tests.indstil(%L, '{"engangs_pris_mode": "loft"}') $$, :'kasse'),
  'P0001', 'indstilling_ugyldig', 'Loft without an amount is rejected');
select throws_ok(
  format($$ select tests.indstil(%L, '{"engangs_pris_mode": "gratis", "engangs_pris": 30}') $$, :'kasse'),
  'P0001', 'indstilling_ugyldig', 'only fri, fast and loft are modes');
select throws_ok(
  format($$ select tests.indstil(%L, '{"engangs_pris_mode": "fast", "engangs_pris": 0}') $$, :'kasse'),
  'P0001', 'indstilling_ugyldig', 'the amount must be above 0 kr');
select throws_ok(
  format($$ select tests.indstil(%L, '{"engangs_pris_mode": "fast", "engangs_pris": 12.5}') $$, :'kasse'),
  'P0001', 'indstilling_ugyldig', 'the amount is whole kroner');

select is(tests.indstil(:'kasse', '{"engangs_pris_mode": "fast", "engangs_pris": 30, "engangsgebyr": 15}'),
  '{}'::jsonb, 'an Admin sets Fast at 30 kr with a 15 kr Gebyr');
select results_eq(
  format($$ select engangs_pris_mode::text, engangs_pris, engangsgebyr from public.bodekasse where id = %L $$, :'kasse'),
  $$ values ('fast', 30, 15) $$,
  'the box now has Fast at 30 kr');

select throws_ok(
  format($$ select tests.indstil(%L, '{"engangs_pris": null}') $$, :'kasse'),
  'P0001', 'indstilling_ugyldig', 'the amount cannot be removed while the mode is Fast');

-- ---------- Fast ----------
select tests.log_ind_som_medlem(:'jonas');
select is(tests.giv_engangs(:'kasse', jsonb_build_object('modtager_id', :'emil', 'grund', 'Fast', 'beloeb', 100)),
  30, 'Fast: the stored amount is the setting, whatever the client sends');
select is(tests.giv_engangs(:'kasse', jsonb_build_object('modtager_id', :'emil', 'grund', 'Fast uden beløb')),
  30, 'Fast: a line without an amount gets the setting too');
select is(tests.giv_engangs(:'kasse', jsonb_build_object('modtager_id', :'emil', 'grund', 'Fast nul', 'beloeb', 0)),
  30, 'Fast: an invalid amount from the client is ignored');
select is(
  (select array_agg(g.beloeb order by g.oprettet) from public.gebyr g join public.bode b on b.id = g.bode_id
    where b.grund like 'Fast%'),
  array[15, 15, 15],
  'Fast: the giver pays the Engangsbøde Gebyr as today');
select throws_ok(
  format($$ select tests.giv_engangs(%L, jsonb_build_object('modtager_id', %L, 'grund', ' ', 'beloeb', 30)) $$,
         :'kasse', :'emil'),
  'P0001', 'grund_mangler', 'Fast: an Engangsbøde still needs a reason');

-- ---------- Loft ----------
select tests.log_ind_som_medlem(:'admin');
select tests.indstil(:'kasse', '{"engangs_pris_mode": "loft", "engangs_pris": 50}');

select tests.log_ind_som_medlem(:'jonas');
select is(tests.giv_engangs(:'kasse', jsonb_build_object('modtager_id', :'emil', 'grund', 'Loft lige', 'beloeb', 50)),
  50, 'Loft: an amount at the cap is allowed');
select is(tests.giv_engangs(:'kasse', jsonb_build_object('modtager_id', :'emil', 'grund', 'Loft under', 'beloeb', 20)),
  20, 'Loft: an amount under the cap is stored as given');
select throws_ok(
  format($$ select tests.giv_engangs(%L, jsonb_build_object('modtager_id', %L, 'grund', 'Loft over', 'beloeb', 51)) $$,
         :'kasse', :'emil'),
  'P0001', 'beloeb_over_loft', 'Loft: an amount above the cap is rejected');
select throws_ok(
  format($$ select tests.giv_engangs(%L, jsonb_build_object('modtager_id', %L, 'grund', 'Loft nul', 'beloeb', 0)) $$,
         :'kasse', :'emil'),
  'P0001', 'beloeb_ugyldig', 'Loft: the amount must still be above 0');

-- ---------- History stays ----------
select tests.log_ind_som_medlem(:'admin');
select tests.indstil(:'kasse', '{"engangs_pris_mode": "fri", "engangsgebyr": 5}');
select results_eq(
  $$ select b.grund, b.pris, g.beloeb from public.bode b left join public.gebyr g on g.bode_id = b.id
      where b.grund in ('Fri', 'Fast', 'Loft under') order by b.grund $$,
  $$ values ('Fast', 30, 15), ('Fri', 777, 10), ('Loft under', 20, 15) $$,
  'changing the settings never changes Bøder or Gebyrer already given');

select tests.log_ind_som_medlem(:'jonas');
select is(tests.giv_engangs(:'kasse', jsonb_build_object('modtager_id', :'emil', 'grund', 'Fri igen', 'beloeb', 500)),
  500, 'back to Fri: any amount again, even above the old cap');

select * from finish();
rollback;
