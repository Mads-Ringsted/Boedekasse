-- Push (#81): subscriptions, toggles, the outbox rows giv_boeder writes
-- ("Bøde modtaget"), the sender's claim/mark RPCs, and waking the sender.
begin;
\ir _hjaelpere.psql
select plan(32);

select tests.opret_bodekasse('Fodboldholdet') as kasse \gset
select tests.opret_medlem_med_login(:'kasse', 'Jonas Holm') as jonas \gset
select tests.opret_medlem_med_login(:'kasse', 'Emil Bach') as emil \gset
select tests.opret_medlem_med_login(:'kasse', 'Kasper Nørgaard') as kasper \gset
select tests.opret_medlem(:'kasse', 'Ole Uden Login') as ole \gset
select tests.opret_bodekategori(:'jonas', 'For sent', 50) as for_sent \gset
select tests.opret_bodekategori(:'jonas', 'Spildt drikke', 1200) as spildt \gset
select user_id as emil_login from public.medlem where id = :'emil' \gset
select user_id as kasper_login from public.medlem where id = :'kasper' \gset
select user_id as jonas_login from public.medlem where id = :'jonas' \gset

create function tests.linje(p_modtager uuid, p_kategori uuid, p_antal int default 1)
returns jsonb language sql as $$
  select jsonb_build_object('modtager_id', p_modtager, 'bodekategori_id', p_kategori, 'antal', p_antal)
$$;
grant execute on function tests.linje(uuid, uuid, int) to authenticated;

-- The outbox as a test sees it.
create function tests.udbakke(p_login uuid)
returns table (art public.push_art, titel text, tekst text, url text)
language sql security definer as $$
  select art, titel, tekst, url from public.push_udbakke where user_id = p_login order by id
$$;
grant execute on function tests.udbakke(uuid) to authenticated;

-- ---------- Bøde modtaget ----------
select tests.log_ind_som_medlem(:'jonas');
select public.giv_boeder(gen_random_uuid(), :'kasse', jsonb_build_array(
  tests.linje(:'emil', :'for_sent', 2),
  tests.linje(:'emil', :'spildt'),
  tests.linje(:'kasper', :'for_sent'),
  tests.linje(:'ole', :'for_sent'),
  tests.linje(:'jonas', :'for_sent'))) ->> 'batch_id' as batch \gset
select tests.log_ud();

select results_eq(
  format('select * from tests.udbakke(%L)', :'emil_login'),
  format($$ values ('bode_modtaget'::public.push_art, '3 nye bøder i Fodboldholdet',
                    'Jonas Holm gav dig For sent ×2, Spildt drikke · 1.300 kr',
                    '/profil?bodekasse=' || %L) $$, :'kasse'),
  'a batch gives each receiver one push that names the Bødekasse, the giver and the Bøder');
select results_eq(
  format('select titel, tekst from tests.udbakke(%L)', :'kasper_login'),
  $$ values ('Ny bøde i Fodboldholdet', 'Jonas Holm gav dig For sent · 50 kr') $$,
  'one Bøde says "Ny bøde"');
select is((select count(*)::int from public.push_udbakke), 2,
  'no push to a Medlem without a login, nor for a Bøde you gave yourself');
select ok((select bool_and(send_efter >= now() + private.fortryd_frist()) from public.push_udbakke),
  'a Bøde push waits until Fortryd is no longer possible');

-- Fortryd takes the unsent pushes with it.
select tests.log_ind_som_medlem(:'jonas');
select public.fortryd_batch(gen_random_uuid(), :'batch');
select tests.log_ud();
select is((select count(*)::int from public.push_udbakke), 0, 'Fortryd removes the batch''s pushes');

-- ---------- Toggles ----------
select tests.log_ind_som(:'emil_login');
select is_empty('select * from public.push_praeference', 'no toggles stored until you change one');
select is(public.saet_push_praeference('bode_modtaget', false),
  '{"bode_modtaget": false, "anke_afstemning": true, "anke_resultat": true,
    "betalingsmelding_venter": true, "betaling_bekraeftet": true, "automatisk_gebyr": true,
    "betalingspaamindelse": true, "andres_aktivitet": false}'::jsonb,
  'turning one kind off answers with every toggle, the rest at their default (opt-in #88 off)');
select results_eq('select bode_modtaget, anke_resultat from public.push_praeference',
  $$ values (false, true) $$, 'you can read your own toggles');
select tests.log_ind_som(:'kasper_login');
select is_empty('select * from public.push_praeference', 'you can''t read someone else''s toggles');

select tests.log_ind_som_medlem(:'jonas');
select public.giv_boeder(gen_random_uuid(), :'kasse', jsonb_build_array(
  tests.linje(:'emil', :'for_sent'), tests.linje(:'kasper', :'for_sent')));
select tests.log_ud();
select is((select count(*)::int from tests.udbakke(:'emil_login')), 0,
  'no push when the receiver turned Bøde modtaget off');
select is((select count(*)::int from tests.udbakke(:'kasper_login')), 1,
  'the others still get theirs');

select tests.log_ind_som(:'emil_login');
select is(public.saet_push_praeference('bode_modtaget', true) ->> 'bode_modtaget', 'true',
  'turning it on again');
select tests.log_ud();
select is(private.push(:'emil_login', 'anke_resultat', :'kasse', 'T', 'B', '/anker') is not null, true,
  'the shared helper queues a push of another kind');
select is((select url from public.push_udbakke where user_id = :'emil_login' and art = 'anke_resultat'),
  '/anker?bodekasse=' || :'kasse', 'its link opens the right box');
select tests.log_ind_som(:'emil_login');
select public.saet_push_praeference('anke_resultat', false);
select tests.log_ud();
select is(private.push(:'emil_login', 'anke_resultat', :'kasse', 'T', 'B', '/anker'), null,
  'the helper applies the toggle for its kind');

-- ---------- Subscriptions ----------
select tests.log_ind_som(:'emil_login');
select is(public.abonner_push('https://push.example/emil-1', 'p256', 'auth'), '{}'::jsonb,
  'a logged-in person subscribes a device');
select public.abonner_push('https://push.example/emil-1', 'p256-ny', 'auth-ny');
select tests.log_ud();
select results_eq(
  format($$ select p256dh, auth from public.push_abonnement where user_id = %L $$, :'emil_login'),
  $$ values ('p256-ny', 'auth-ny') $$, 'subscribing the same device again updates its keys');

select tests.log_ind_som(:'kasper_login');
select public.abonner_push('https://push.example/emil-1', 'p256-k', 'auth-k');
select tests.log_ud();
select is((select user_id from public.push_abonnement where endpoint = 'https://push.example/emil-1'),
  :'kasper_login'::uuid, 'a device someone else logs in on moves to them');

select tests.log_ind_som(:'emil_login');
select throws_ok($$ select public.abonner_push('http://push.example/x', 'p', 'a') $$,
  'P0001', 'abonnement_ugyldigt', 'an endpoint must be https');
select public.afmeld_push('https://push.example/emil-1');
select tests.log_ud();
select is((select count(*)::int from public.push_abonnement), 1,
  'you can''t unsubscribe someone else''s device');
select tests.log_ind_som(:'kasper_login');
select public.afmeld_push('https://push.example/emil-1');
select tests.log_ud();
select is((select count(*)::int from public.push_abonnement), 0, 'unsubscribing your own device');

select tests.log_ind_som_anon();
select throws_ok($$ select public.abonner_push('https://push.example/x', 'p', 'a') $$,
  '42501', null, 'a visitor without login can''t subscribe');
select tests.log_ud();

-- ---------- The sender's side ----------
delete from public.push_udbakke;
select tests.log_ind_som(:'kasper_login');
select public.abonner_push('https://push.example/kasper-1', 'p1', 'a1');
select public.abonner_push('https://push.example/kasper-2', 'p2', 'a2');
select tests.log_ud();
select private.push(:'kasper_login', 'anke_resultat', :'kasse', 'Nu', 'Klar', '/anker') as klar_id \gset
select private.push(:'kasper_login', 'anke_resultat', :'kasse', 'Senere', 'Venter', '/anker',
                    now() + interval '1 minute') as senere_id \gset

select tests.log_ind_som(:'kasper_login');
select throws_ok('select public.push_hent_klar(10)', '42501', null, 'the app can''t read the outbox');
select tests.log_ud();

set local role service_role;
select results_eq('select x ->> ''id'', x ->> ''titel'', x -> ''abonnementer'' from jsonb_array_elements(public.push_hent_klar(10)) x',
  format($$ values (%L, 'Nu', '[{"endpoint": "https://push.example/kasper-1", "p256dh": "p1", "auth": "a1"},
                               {"endpoint": "https://push.example/kasper-2", "p256dh": "p2", "auth": "a2"}]'::jsonb) $$,
         :'klar_id'),
  'the sender gets due rows with every device of the login, not rows that must wait');
select is(public.push_hent_klar(10), '[]'::jsonb, 'a claimed row is not handed out twice');
select public.push_marker(:'klar_id', null);
select public.push_fjern_abonnement('https://push.example/kasper-2');
reset role;
select ok((select sendt is not null and fejl is null from public.push_udbakke where id = :'klar_id'),
  'the sender marks a row sent');
select is((select count(*)::int from public.push_abonnement where user_id = :'kasper_login'), 1,
  'the sender removes a dead subscription');

update public.push_udbakke set send_efter = now() where id = :'senere_id';
set local role service_role;
select is(jsonb_array_length(public.push_hent_klar(10)), 1, 'a waiting row is due once its time comes');
select public.push_marker(:'senere_id', '410 Gone');
reset role;
select results_eq(format('select sendt, fejl from public.push_udbakke where id = %L', :'senere_id'),
  $$ values (null::timestamptz, '410 Gone') $$, 'the sender marks a row failed');

-- ---------- Waking the sender ----------
create function tests.vaekninger() returns int language sql as $$
  select count(*)::int from net.http_request_queue where url = 'https://fn.example/send-push'
$$;
select private.push(:'kasper_login', 'anke_resultat', :'kasse', 'A', 'B', '/anker');
select is(tests.vaekninger(), 0, 'with no sender configured, a push wakes nothing (and doesn''t fail)');

select vault.create_secret('https://fn.example/send-push', 'push_send_url');
select vault.create_secret('hemmelig', 'push_send_secret');
select private.push(:'kasper_login', 'anke_resultat', :'kasse', 'A', 'B', '/anker');
select is(tests.vaekninger(), 1, 'once configured, a due push wakes the sender');
select is((select headers ->> 'Authorization' from net.http_request_queue
            where url = 'https://fn.example/send-push'), 'Bearer hemmelig',
  'it authenticates with the shared secret');

select * from finish();
rollback;
