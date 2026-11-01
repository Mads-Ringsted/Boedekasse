-- Push "Aktivitet fra andre" (#88): an opt-in push about every feed entry in
-- your Bødekasser. It goes to every active Medlem who turned it on, except
-- the one who did the action and anyone the entry already notifies through
-- their own push type (even when they turned that type off). One push per
-- person, box and statement: a Giv batch or a scheduler run is one push.
begin;
\ir _hjaelpere.psql
select plan(16);

-- The "Aktivitet fra andre" pushes in a box, as a test sees them.
create function tests.andre_push(p_kasse uuid)
returns table (navn text, titel text, tekst text, url text, send_efter timestamptz)
language sql security definer as $$
  select m.navn, u.titel, u.tekst, u.url, u.send_efter
    from public.push_udbakke u
    join public.medlem m on m.user_id = u.user_id and m.bodekasse_id = u.bodekasse_id
   where u.art = 'andres_aktivitet' and u.bodekasse_id = p_kasse
   order by m.navn, u.id
$$;

-- One push's lines, sorted (a batch's entries come in no fixed order).
create function tests.linjer(p_tekst text) returns text[]
language sql immutable as $$
  select array_agg(l order by l) from unnest(string_to_array(p_tekst, E'\n')) l
$$;

-- Empties the outbox between steps (as the test superuser).
create function tests.toem() returns void language sql security definer as $$
  delete from public.push_udbakke
$$;

-- Turns "Aktivitet fra andre" on for a Medlem's login.
create function tests.tilmeld_andre(p_medlem uuid) returns void language plpgsql as $$
begin
  perform tests.log_ind_som_medlem(p_medlem);
  perform public.saet_push_praeference('andres_aktivitet', true);
  perform tests.log_ud();
end $$;

select tests.opret_bodekasse('Holdet') as kasse \gset
select tests.opret_medlem_med_login(:'kasse', 'Anna', true) as anna \gset
select tests.opret_medlem_med_login(:'kasse', 'Bo') as bo \gset
select tests.opret_medlem_med_login(:'kasse', 'Cia') as cia \gset
select tests.opret_medlem_med_login(:'kasse', 'Dan') as dan \gset
select tests.opret_medlem_med_login(:'kasse', 'Eva') as eva \gset
select tests.opret_medlem_med_login(:'kasse', 'Gry') as gry \gset
select tests.opret_bodekategori(:'anna', 'For sent', 20) as for_sent \gset
update public.bodekasse set anke_til = true where id = :'kasse';

-- ---------- Off by default ----------
select tests.log_ind_som_medlem(:'anna');
select public.giv_boeder(gen_random_uuid(), :'kasse', jsonb_build_array(
  jsonb_build_object('modtager_id', :'bo', 'bodekategori_id', :'for_sent', 'antal', 1)));
select tests.log_ud();
select is_empty(
  format($$ select 1 from tests.andre_push(%L) $$, :'kasse'),
  'nobody gets Aktivitet fra andre until they turn it on');
select tests.log_ind_som_medlem(:'cia');
select is(
  public.saet_push_praeference('bode_modtaget', true) ->> 'andres_aktivitet',
  'false',
  'the toggle is off for someone who has stored other toggles');
select tests.log_ud();

-- Everyone but Dan opts in. Eva is then meldt ud.
select tests.tilmeld_andre(m) from unnest(array[:'anna', :'bo', :'cia', :'eva', :'gry']::uuid[]) m;
select tests.log_ind_som_medlem(:'anna');
select public.udmeld(gen_random_uuid(), :'kasse', :'eva');
select tests.log_ud();
select tests.toem();

-- ---------- A Bøde ----------
-- Anna gives Bo two. Bo gets his own Bøde push; Cia and Gry hear about it.
select tests.log_ind_som_medlem(:'anna');
select public.giv_boeder(gen_random_uuid(), :'kasse', jsonb_build_array(
  jsonb_build_object('modtager_id', :'bo', 'bodekategori_id', :'for_sent', 'antal', 2)));
select tests.log_ud();
select results_eq(
  format($$ select navn, titel, tekst, url from tests.andre_push(%L) $$, :'kasse'),
  format($$ values
    ('Cia', 'Ny aktivitet i Holdet', 'Anna gav Bo For sent ×2 · 40 kr', '/aktivitet?bodekasse=' || %1$L),
    ('Gry', 'Ny aktivitet i Holdet', 'Anna gav Bo For sent ×2 · 40 kr', '/aktivitet?bodekasse=' || %1$L) $$,
    :'kasse'),
  'opted-in Medlemmer hear about a Bøde, naming the box; not Dan, who did not opt in');
select is_empty(
  format($$ select 1 from tests.andre_push(%L) where navn = 'Anna' $$, :'kasse'),
  'the giver hears nothing about her own action');
select results_eq(
  format($$ select art::text from public.push_udbakke u join public.medlem m on m.user_id = u.user_id
             where m.id = %L $$, :'bo'),
  $$ values ('bode_modtaget') $$,
  'the receiver gets only his own Bøde push, never the same entry twice');
select is_empty(
  format($$ select 1 from tests.andre_push(%L) where navn = 'Eva' $$, :'kasse'),
  'an Udmeldt Medlem gets nothing');
select is(
  (select distinct send_efter from tests.andre_push(:'kasse')),
  now() + private.fortryd_frist(),
  'a Bøde push waits out the Fortryd grace, like the Bøde push');
select tests.toem();

-- A receiver who turned his own Bøde push off is still not told about his own Bøde.
select tests.log_ind_som_medlem(:'bo');
select public.saet_push_praeference('bode_modtaget', false);
select tests.log_ind_som_medlem(:'anna');
select public.giv_boeder(gen_random_uuid(), :'kasse', jsonb_build_array(
  jsonb_build_object('modtager_id', :'bo', 'grund', 'Sang falsk', 'beloeb', 30)));
select tests.log_ud();
select results_eq(
  format($$ select navn from tests.andre_push(%L) $$, :'kasse'),
  $$ values ('Cia'), ('Gry') $$,
  'the receiver stays out even with his own Bøde push turned off');
select tests.toem();

-- ---------- Anke ----------
-- Bo appeals a For sent. Cia, Dan and Gry may decide it (Anke push), so of
-- the opted-in only the giver, Anna, hears it here.
select tests.log_ind_som_medlem(:'bo');
select public.indgiv_anke(gen_random_uuid(),
  (select id from public.bode where modtager_id = :'bo' and bodekategori_id is not null order by givet desc limit 1))
  ->> 'anke_id' as anke \gset
select tests.log_ud();
select results_eq(
  format($$ select navn, tekst from tests.andre_push(%L) $$, :'kasse'),
  $$ values ('Anna', 'Bo ankede For sent fra dig · 20 kr') $$,
  'an Anke reaches only those its Anke push does not: here the giver');
select tests.toem();

-- Cia decides it. Bo and Anna get the result push; Gry hears it here.
select tests.log_ind_som_medlem(:'cia');
select public.afgoer_anke(gen_random_uuid(), :'anke', 'giver_vandt');
select tests.log_ud();
select results_eq(
  format($$ select navn, tekst from tests.andre_push(%L) $$, :'kasse'),
  $$ values ('Gry', 'Bo tabte anken mod Anna: For sent · 20 kr') $$,
  'a verdict reaches neither who decided it nor the two parties');
select tests.toem();

-- ---------- Indbetaling ----------
select tests.log_ind_som_medlem(:'anna');
select public.registrer_indbetaling(gen_random_uuid(), :'kasse', :'bo', 100);
select tests.log_ud();
select results_eq(
  format($$ select navn, tekst, send_efter from tests.andre_push(%L) $$, :'kasse'),
  $$ values ('Bo', 'Anna registrerede en indbetaling fra dig · 100 kr', now()),
            ('Cia', 'Anna registrerede en indbetaling fra Bo · 100 kr', now()),
            ('Gry', 'Anna registrerede en indbetaling fra Bo · 100 kr', now()) $$,
  'an Indbetaling with no push of its own reaches the payer too, and is sent at once');
select tests.toem();

-- ---------- A Giv batch, with a Dos-bonus ----------
update public.bodekasse set dos_bonus_til = true, dos_bonus_beloeb = 10 where id = :'kasse';
select tests.log_ind_som_medlem(:'anna');
select public.giv_boeder(gen_random_uuid(), :'kasse', jsonb_build_array(
  jsonb_build_object('modtager_id', :'cia', 'bodekategori_id', :'for_sent', 'antal', 2),
  jsonb_build_object('modtager_id', :'gry', 'bodekategori_id', :'for_sent', 'antal', 1)))
  ->> 'batch_id' as batch \gset
select tests.log_ud();
select results_eq(
  format($$ select navn, titel, tests.linjer(tekst) from tests.andre_push(%L) $$, :'kasse'),
  $$ values
    ('Bo', '3 nye aktiviteter i Holdet',
     array['Anna gav Cia For sent ×2 · 40 kr', 'Anna gav Gry For sent · 20 kr', 'Cia fik en Dos-bonus · 10 kr']),
    ('Cia', 'Ny aktivitet i Holdet', array['Anna gav Gry For sent · 20 kr']),
    ('Gry', '2 nye aktiviteter i Holdet',
     array['Anna gav Cia For sent ×2 · 40 kr', 'Cia fik en Dos-bonus · 10 kr']) $$,
  'a Giv batch gives one push per opted-in Medlem, leaving out the entries about them');
select is_empty(
  format($$ select 1 from tests.andre_push(%L) where navn = 'Anna' $$, :'kasse'),
  'the giver hears nothing about the Dos-bonus her Giv charged');

select tests.log_ind_som_medlem(:'anna');
select public.fortryd_batch(gen_random_uuid(), :'batch');
select tests.log_ud();
select is_empty(
  format($$ select 1 from tests.andre_push(%L) $$, :'kasse'),
  'Fortryd deletes the batch''s unsent pushes');

-- ---------- A scheduler run ----------
-- On 1 February the monthly rule "Kontingent" (25 kr, day 1) charges Hans
-- and Ida. Hans and Jon opted in; Ida did not.
select tests.opret_bodekasse('Månedsholdet') as maaned \gset
update public.saeson set startet = '2026-01-01 00:00 Europe/Copenhagen' where bodekasse_id = :'maaned';
select tests.opret_medlem_med_login(:'maaned', 'Hans', true) as hans \gset
select tests.opret_medlem_med_login(:'maaned', 'Ida') as ida \gset
select tests.opret_medlem_med_login(:'maaned', 'Jon') as jon \gset
select tests.tilmeld_andre(m) from unnest(array[:'hans', :'jon']::uuid[]) m;
select tests.log_ind_som_medlem(:'hans');
select public.opret_tilbagevendende(gen_random_uuid(), :'maaned', 'Kontingent', 25, 'maaned', 1,
  array[:'hans', :'ida']::uuid[]) ->> 'tilbagevendende_id' as regel \gset
select tests.log_ud();
update public.tilbagevendende set aendret = '2026-01-01 00:00 Europe/Copenhagen' where id = :'regel';
select tests.toem();

select private.koer_automatik('2026-02-01 00:30 Europe/Copenhagen');
select results_eq(
  format($$ select navn, titel, tests.linjer(tekst) from tests.andre_push(%L) $$, :'maaned'),
  $$ values
    ('Hans', 'Ny aktivitet i Månedsholdet', array['Ida fik gebyret Kontingent · 25 kr']),
    ('Jon', '2 nye aktiviteter i Månedsholdet',
     array['Hans fik gebyret Kontingent · 25 kr', 'Ida fik gebyret Kontingent · 25 kr']) $$,
  'one scheduler run gives one push per opted-in Medlem, never about their own Gebyr');
select is(
  (select count(*)::int from public.push_udbakke where art = 'automatisk_gebyr' and bodekasse_id = :'maaned'),
  2,
  'the automatic-Gebyr pushes are unchanged');

select * from finish();
rollback;
