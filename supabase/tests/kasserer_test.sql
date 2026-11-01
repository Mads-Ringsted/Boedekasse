-- Kasserer (#75): an Admin gives or takes the Kasserer role. A Kasserer
-- handles the money without being Admin: confirms or rejects
-- Betalingsmeldinger (never their own), registers and annuls Indbetalinger,
-- and makes and annuls Hævninger. Admins keep every power. An Udmeldt
-- Kasserer has none.
begin;
\ir _hjaelpere.psql
select plan(15);

select tests.opret_bodekasse() as kasse \gset
select tests.opret_medlem_med_login(:'kasse', 'Anna', true) as anna \gset
select tests.opret_medlem_med_login(:'kasse', 'Bo') as bo \gset
select tests.opret_medlem_med_login(:'kasse', 'Cille') as cille \gset
select tests.opret_medlem_med_login(:'kasse', 'Dan') as dan \gset
select tests.giv_bode(:'anna', :'cille', 200);

-- ---------- Setting the role ----------

select ok(not (select er_kasserer from public.medlem where id = :'bo'), 'a Medlem is not Kasserer by default');

select tests.log_ind_som_medlem(:'bo');
select throws_ok(format($$ select public.saet_kasserer(gen_random_uuid(), %L, %L, true) $$, :'kasse', :'bo'),
  '42501', 'ikke_admin', 'a plain Medlem can''t give the Kasserer role');

select tests.log_ind_som_medlem(:'anna');
select gen_random_uuid() as id1 \gset
select is(public.saet_kasserer(:'id1', :'kasse', :'bo', true), jsonb_build_object('er_kasserer', true),
  'an Admin makes a Medlem Kasserer');
select is(public.saet_kasserer(:'id1', :'kasse', :'bo', true), jsonb_build_object('er_kasserer', true),
  'a retry with the same one-time ID returns the first answer');
-- Several Kasserere are fine.
select public.saet_kasserer(gen_random_uuid(), :'kasse', :'dan', true);
select results_eq(
  format($$ select count(*)::int from public.medlem where bodekasse_id = %L and er_kasserer $$, :'kasse'),
  $$ values (2) $$, 'a Bødekasse can have several Kasserere');

-- ---------- A Kasserer handles the money ----------

select tests.log_ind_som_medlem(:'bo');
select public.registrer_indbetaling(gen_random_uuid(), :'kasse', :'cille', 100) ->> 'indbetaling_id' as i1 \gset
select public.haev(gen_random_uuid(), :'kasse', 30, 'Øl') ->> 'haevning_id' as h1 \gset
select public.annuller_indbetaling(gen_random_uuid(), :'i1');
select public.annuller_haevning(gen_random_uuid(), :'h1');
select results_eq(
  format($$ select (select registreret_af from public.indbetaling where id = %L),
                   (select annulleret_af from public.indbetaling where id = %L),
                   (select registreret_af from public.haevning where id = %L),
                   (select annulleret_af from public.haevning where id = %L) $$, :'i1', :'i1', :'h1', :'h1'),
  format($$ values (%L::uuid, %L::uuid, %L::uuid, %L::uuid) $$, :'bo', :'bo', :'bo', :'bo'),
  'a Kasserer registers and annuls an Indbetaling, and makes and annuls a Hævning');

-- ---------- Betalingsmeldinger ----------

select tests.log_ind_som_medlem(:'cille');
select public.meld_betaling(gen_random_uuid(), :'kasse', 50) ->> 'betalingsmelding_id' as m1 \gset
select throws_ok(format($$ select public.behandl_betalingsmelding(gen_random_uuid(), %L, true) $$, :'m1'),
  '42501', 'ikke_kasserer', 'a plain Medlem can''t confirm a Betalingsmelding');
select throws_ok(format($$ select public.behandl_betalingsmelding(gen_random_uuid(), %L, false) $$, :'m1'),
  '42501', 'ikke_kasserer', '... nor reject one');

select tests.log_ind_som_medlem(:'bo');
select public.behandl_betalingsmelding(gen_random_uuid(), :'m1', true);
select results_eq(
  format($$ select status::text, behandlet_af from public.betalingsmelding where id = %L $$, :'m1'),
  format($$ values ('bekraeftet', %L::uuid) $$, :'bo'),
  'a Kasserer confirms a Betalingsmelding');

-- A Kasserer can't confirm their own; another Kasserer can.
select public.meld_betaling(gen_random_uuid(), :'kasse', 20) ->> 'betalingsmelding_id' as m2 \gset
select throws_ok(format($$ select public.behandl_betalingsmelding(gen_random_uuid(), %L, true) $$, :'m2'),
  'P0001', 'egen_melding', 'a Kasserer can''t confirm their own Betalingsmelding');
select tests.log_ind_som_medlem(:'dan');
select public.behandl_betalingsmelding(gen_random_uuid(), :'m2', false);
select results_eq(
  format($$ select status::text, behandlet_af from public.betalingsmelding where id = %L $$, :'m2'),
  format($$ values ('afvist', %L::uuid) $$, :'dan'),
  'another Kasserer rejects it');

-- ---------- Taking the role away, and Udmeldt ----------

select tests.log_ind_som_medlem(:'anna');
select is(public.saet_kasserer(gen_random_uuid(), :'kasse', :'dan', false), jsonb_build_object('er_kasserer', false),
  'an Admin takes the Kasserer role away');
select tests.log_ind_som_medlem(:'dan');
select throws_ok(format($$ select public.registrer_indbetaling(gen_random_uuid(), %L, %L, 10) $$, :'kasse', :'cille'),
  '42501', 'ikke_kasserer', 'without the role, money actions are refused');

-- Bo is meldt ud: he loses the role and every money power.
select tests.log_ind_som_medlem(:'anna');
select public.udmeld(gen_random_uuid(), :'kasse', :'bo');
select ok(not (select er_kasserer from public.medlem where id = :'bo'), 'an Udmeldt Kasserer loses the role');
select throws_ok(format($$ select public.saet_kasserer(gen_random_uuid(), %L, %L, true) $$, :'kasse', :'bo'),
  'P0001', 'medlem_udmeldt', 'an Udmeldt Medlem can''t be made Kasserer');

select * from finish();
rollback;
