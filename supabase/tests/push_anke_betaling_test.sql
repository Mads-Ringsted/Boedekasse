-- Push for Anke and payments (#82): the outbox rows for "Anke afstemning",
-- "Anke resultat", "Betalingsmelding venter" and "Betaling bekræftet".
-- Each names the Bødekasse, links to the screen to act on, and respects the
-- recipient's toggle for its kind.
begin;
\ir _hjaelpere.psql
select plan(11);

select tests.opret_bodekasse('Fodboldholdet') as kasse \gset
select tests.opret_medlem_med_login(:'kasse', 'Mads Admin', true) as mads \gset
select tests.opret_medlem_med_login(:'kasse', 'Jonas Holm') as jonas \gset
select tests.opret_medlem_med_login(:'kasse', 'Emil Bach') as emil \gset
select tests.opret_medlem_med_login(:'kasse', 'Kasper Nørgaard') as kasper \gset
select tests.opret_medlem_med_login(:'kasse', 'Lise Udmeldt') as lise \gset
select tests.opret_medlem(:'kasse', 'Ole Uden Login') as ole \gset
update public.medlem set udmeldt = now() where id = :'lise';
select tests.opret_bodekategori(:'mads', 'For sent', 50) as for_sent \gset
select user_id as mads_login from public.medlem where id = :'mads' \gset
select user_id as jonas_login from public.medlem where id = :'jonas' \gset
select user_id as emil_login from public.medlem where id = :'emil' \gset
select user_id as kasper_login from public.medlem where id = :'kasper' \gset

select tests.log_ind_som_medlem(:'mads');
select public.opdater_indstillinger(gen_random_uuid(), :'kasse', '{"anke_til": true}');
select tests.log_ud();

-- The outbox of one kind, as a test sees it.
create function tests.udbakke(p_art public.push_art)
returns table (navn text, titel text, tekst text, url text)
language sql security definer as $$
  select m.navn, u.titel, u.tekst, u.url
    from public.push_udbakke u
    join public.medlem m on m.user_id = u.user_id
   where u.art = p_art
   order by m.navn
$$;

-- ---------- Anke afstemning ----------
-- Jonas gives Emil a Bøde; Emil appeals it.
select tests.giv_bode(:'jonas', :'emil', p_kategori => :'for_sent') as b1 \gset
select tests.log_ind_som_medlem(:'emil');
select public.indgiv_anke(gen_random_uuid(), :'b1') ->> 'anke_id' as a1 \gset
select tests.log_ud();

select results_eq(
  $$ select * from tests.udbakke('anke_afstemning') $$,
  format($$ values
    ('Kasper Nørgaard', 'Ny anke i Fodboldholdet',
     'Emil Bach anker For sent (50 kr) fra Jonas Holm. Afgør den nu.',
     '/anker?bode=' || %1$L || '&bodekasse=' || %2$L),
    ('Mads Admin', 'Ny anke i Fodboldholdet',
     'Emil Bach anker For sent (50 kr) fra Jonas Holm. Afgør den nu.',
     '/anker?bode=' || %1$L || '&bodekasse=' || %2$L) $$, :'b1', :'kasse'),
  'an Anke tells every active Medlem who may decide it, never the giver, the receiver, an Udmeldt or one without login');

-- Kasper turns Anke afstemning off; Emil gives Jonas a Bøde and Jonas appeals.
select tests.log_ind_som(:'kasper_login');
select public.saet_push_praeference('anke_afstemning', false);
select tests.log_ud();
select tests.giv_bode(:'emil', :'jonas', p_kategori => :'for_sent') as b2 \gset
select tests.log_ind_som_medlem(:'jonas');
select public.indgiv_anke(gen_random_uuid(), :'b2') ->> 'anke_id' as a2 \gset
select tests.log_ud();
select results_eq(
  format($$ select navn from tests.udbakke('anke_afstemning') where url like '/anker?bode=%s%%' $$, :'b2'),
  $$ values ('Mads Admin') $$,
  'no Anke afstemning push to one who turned it off');

-- ---------- Anke resultat ----------
-- Kasper decides Emil's Anke: it wins, so the Bøde moves to Jonas.
select tests.log_ind_som_medlem(:'kasper');
select public.afgoer_anke(gen_random_uuid(), :'a1', 'modtager_vandt');
select tests.log_ud();
select results_eq(
  $$ select * from tests.udbakke('anke_resultat') $$,
  format($$ values
    ('Emil Bach', 'Anke afgjort i Fodboldholdet',
     'Du vandt anken. Jonas Holm betaler For sent (50 kr).',
     '/anker?bode=' || %1$L || '&bodekasse=' || %2$L),
    ('Jonas Holm', 'Anke afgjort i Fodboldholdet',
     'Emil Bach vandt anken. Du betaler For sent (50 kr).',
     '/anker?bode=' || %1$L || '&bodekasse=' || %2$L) $$, :'b1', :'kasse'),
  'a verdict tells both parties who pays, and nobody else');

-- Jonas turns Anke resultat off; Mads (Admin) changes the verdict.
select tests.log_ind_som(:'jonas_login');
select public.saet_push_praeference('anke_resultat', false);
select tests.log_ud();
delete from public.push_udbakke;
select tests.log_ind_som_medlem(:'mads');
select public.aendr_afgoerelse(gen_random_uuid(), :'a1', 'giver_vandt');
select tests.log_ud();
select results_eq(
  $$ select navn, titel, tekst from tests.udbakke('anke_resultat') $$,
  $$ values ('Emil Bach', 'Afgørelse ændret i Fodboldholdet',
             'Bøden står ved magt. Du betaler For sent (50 kr).') $$,
  'a changed verdict is a result too, and skips a party who turned it off');

-- The verdict on Jonas's Anke, for the giver's text when the Bøde stands.
select tests.log_ind_som_medlem(:'kasper');
select public.afgoer_anke(gen_random_uuid(), :'a2', 'giver_vandt');
select tests.log_ud();
select results_eq(
  format($$ select navn, tekst from tests.udbakke('anke_resultat') where url like '/anker?bode=%s%%' $$, :'b2'),
  $$ values ('Emil Bach', 'Bøden står ved magt. Jonas Holm betaler For sent (50 kr).') $$,
  'the giver hears that the Bøde stands');

-- ---------- Betalingsmelding venter ----------
-- Kasper is Kasserer. Lise was one before she was Udmeldt.
update public.medlem set er_kasserer = true where id in (:'kasper', :'lise');
create function tests.meld(p_medlem uuid, p_beloeb int) returns uuid
language plpgsql as $$
declare v_id uuid;
begin
  perform tests.log_ind_som_medlem(p_medlem);
  v_id := public.meld_betaling(gen_random_uuid(),
            (select bodekasse_id from public.medlem where id = p_medlem), p_beloeb)
          ->> 'betalingsmelding_id';
  perform tests.log_ud();
  return v_id;
end $$;

select tests.meld(:'emil', 200) as m_emil \gset
select results_eq(
  $$ select * from tests.udbakke('betalingsmelding_venter') $$,
  format($$ values
    ('Kasper Nørgaard', 'Betaling venter i Fodboldholdet',
     'Emil Bach har betalt 200 kr. Bekræft eller afvis den.', '/kassen?bodekasse=' || %1$L),
    ('Mads Admin', 'Betaling venter i Fodboldholdet',
     'Emil Bach har betalt 200 kr. Bekræft eller afvis den.', '/kassen?bodekasse=' || %1$L) $$,
    :'kasse'),
  'a Betalingsmelding tells the active Admins and Kasserere, not plain Medlemmer');

delete from public.push_udbakke;
select tests.meld(:'kasper', 100) as m_kasper \gset
select tests.meld(:'mads', 300) as m_mads \gset
select results_eq(
  $$ select navn, tekst from tests.udbakke('betalingsmelding_venter') $$,
  $$ values ('Kasper Nørgaard', 'Mads Admin har betalt 300 kr. Bekræft eller afvis den.'),
            ('Mads Admin', 'Kasper Nørgaard har betalt 100 kr. Bekræft eller afvis den.') $$,
  'never to the one who reported it, Admin or Kasserer');

delete from public.push_udbakke;
select tests.log_ind_som(:'kasper_login');
select public.saet_push_praeference('betalingsmelding_venter', false);
select tests.log_ud();
select tests.meld(:'jonas', 50) as m_jonas \gset
select results_eq(
  $$ select navn from tests.udbakke('betalingsmelding_venter') $$,
  $$ values ('Mads Admin') $$,
  'no Betalingsmelding venter push to one who turned it off');

-- ---------- Betaling bekræftet ----------
delete from public.push_udbakke;
select tests.log_ind_som_medlem(:'kasper');
select public.behandl_betalingsmelding(gen_random_uuid(), :'m_emil', true);
select tests.log_ud();
select tests.log_ind_som_medlem(:'mads');
select public.behandl_betalingsmelding(gen_random_uuid(), :'m_jonas', false);
select public.behandl_betalingsmelding(gen_random_uuid(), :'m_mads', true);
select tests.log_ud();
select results_eq(
  $$ select * from tests.udbakke('betaling_bekraeftet') $$,
  format($$ values
    ('Emil Bach', 'Betaling bekræftet i Fodboldholdet',
     'Kasper Nørgaard bekræftede din betaling på 200 kr.', '/profil?bodekasse=' || %L) $$, :'kasse'),
  'the payer hears their payment is confirmed; not when rejected, nor when an Admin confirms their own');

select tests.log_ind_som(:'kasper_login');
select public.saet_push_praeference('betaling_bekraeftet', false);
select tests.log_ud();
select tests.log_ind_som_medlem(:'mads');
select public.behandl_betalingsmelding(gen_random_uuid(), :'m_kasper', true);
select tests.log_ud();
select is((select count(*)::int from public.push_udbakke
            where art = 'betaling_bekraeftet' and user_id = :'kasper_login'), 0,
  'no Betaling bekræftet push to one who turned it off');
select is((select count(*)::int from public.push_udbakke where art <> 'betaling_bekraeftet'), 0,
  'handling a Betalingsmelding writes no push of another kind');

select * from finish();
rollback;
