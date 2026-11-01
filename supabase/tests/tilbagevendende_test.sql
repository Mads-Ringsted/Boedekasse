-- Tilbagevendende Gebyr (#79): an Admin sets up rules with a name, an amount,
-- the Medlemmer they hit and a weekly or monthly frequency. The automation
-- function (injected "now") charges each occurrence on its local date.
-- 2026-03-02 is a Monday. Summer time starts on Sunday 29 March 2026.
begin;
\ir _hjaelpere.psql
select plan(45);

-- A box whose first Sæson started on 1 January 2026.
create function tests.kasse_fra_januar(p_navn text)
returns uuid language plpgsql as $$
declare v_kasse uuid := tests.opret_bodekasse(p_navn);
begin
  update public.saeson set startet = '2026-01-01 00:00 Europe/Copenhagen' where bodekasse_id = v_kasse;
  return v_kasse;
end $$;

-- A rule made through the RPC as the Admin, as if last changed on 1 January
-- 2026 (now() is real time, later than the chosen dates).
create function tests.regel(
  p_admin uuid, p_navn text, p_beloeb int, p_frekvens text, p_dag int, p_medlemmer uuid[])
returns uuid language plpgsql as $$
declare v_id uuid;
begin
  perform tests.log_ind_som_medlem(p_admin);
  v_id := (public.opret_tilbagevendende(gen_random_uuid(),
             (select bodekasse_id from public.medlem where id = p_admin),
             p_navn, p_beloeb, p_frekvens::public.tilbagevendende_frekvens, p_dag, p_medlemmer)
           ->> 'tilbagevendende_id')::uuid;
  perform tests.log_ud();
  update public.tilbagevendende set aendret = '2026-01-01 00:00 Europe/Copenhagen' where id = v_id;
  return v_id;
end $$;

-- Who paid a rule, by occurrence date and name.
create function tests.betalt(p_regel uuid)
returns table (navn text, udloeser date, beloeb int) language sql as $$
  select m.navn, g.udloeser, g.beloeb from public.gebyr g join public.medlem m on m.id = g.medlem_id
   where g.tilbagevendende_id = p_regel and g.art = 'tilbagevendende' order by g.udloeser, m.navn
$$;

-- ---------- A weekly occurrence charges each listed Medlem ----------
select tests.kasse_fra_januar('Ugentlig') as uge \gset
select tests.opret_medlem_med_login(:'uge', 'Anna', true) as anna \gset
select tests.opret_medlem_med_login(:'uge', 'Bo') as bo \gset
select tests.opret_medlem(:'uge', 'Cia') as cia \gset
select tests.regel(:'anna', 'Kontingent', 25, 'uge', 1, array[:'anna', :'bo']::uuid[]) as kontingent \gset
select id as uge_s from public.saeson where bodekasse_id = :'uge' \gset

select private.koer_automatik('2026-03-02 00:00 Europe/Copenhagen');
select results_eq(format($$ select * from tests.betalt(%L) $$, :'kontingent'),
  $$ values ('Anna', '2026-03-02'::date, 25), ('Bo', '2026-03-02'::date, 25) $$,
  'a weekly occurrence charges each listed Medlem the amount, on its date; an unlisted one pays nothing');

select results_eq(
  format($$ select distinct saeson_id, oprettet, annulleret from public.gebyr
             where tilbagevendende_id = %L $$, :'kontingent'),
  format($$ values (%L::uuid, '2026-03-02 00:00 Europe/Copenhagen'::timestamptz, null::timestamptz) $$, :'uge_s'),
  'the Gebyr is in the running Sæson, dated to the start of the occurrence day');

select is((select saldo from public.medlem_saldo where medlem_id = :'bo'), 25,
  'it counts in Saldo at once');

select results_eq(
  format($$ select h.art, h.aktoer_id, h.ref_tabel, h.data->>'navn', (h.data->>'beloeb')::int,
                   h.data->>'dato', h.saeson_id
              from public.haendelse h where h.modtager_id = %L and h.art = 'tilbagevendende' $$, :'bo'),
  format($$ values ('tilbagevendende', null::uuid, 'gebyr', 'Kontingent', 25, '2026-03-02', %L::uuid) $$, :'uge_s'),
  'each charge gets a feed entry from the system for the payer, naming the rule');

-- ---------- Idempotent, and only on the occurrence day ----------
select private.koer_automatik('2026-03-02 00:00 Europe/Copenhagen');
select private.koer_automatik('2026-03-02 23:30 Europe/Copenhagen');
select is((select count(*)::int from public.gebyr where tilbagevendende_id = :'kontingent'), 2,
  'running again on the same day charges nothing extra');
select is((select count(*)::int from public.haendelse where bodekasse_id = :'uge' and art = 'tilbagevendende'), 2,
  'and adds no feed entries');

select private.koer_automatik('2026-03-03 12:00 Europe/Copenhagen');
select private.koer_automatik('2026-03-08 12:00 Europe/Copenhagen');
select private.koer_automatik('2026-03-29 21:30+00');   -- 23:30 on Sunday 29 March
-- That run also catches up the missed Monday 23 March (within 7 days), but not 16 March.
select results_eq(
  format($$ select * from tests.betalt(%L) where udloeser > '2026-03-02' $$, :'kontingent'),
  $$ values ('Anna', '2026-03-23'::date, 25), ('Bo', '2026-03-23'::date, 25) $$,
  'no charge on other weekdays, by the Copenhagen calendar: 23:30 on Sunday is not Monday yet');

select private.koer_automatik('2026-03-29 22:30+00');   -- 00:30 on Monday 30 March (summer time)
select results_eq(
  format($$ select * from tests.betalt(%L) where udloeser > '2026-03-23' $$, :'kontingent'),
  $$ values ('Anna', '2026-03-30'::date, 25), ('Bo', '2026-03-30'::date, 25) $$,
  'the next Monday charges again, also across the change to summer time');

-- ---------- Monthly ----------
select tests.kasse_fra_januar('Månedlig') as md \gset
select tests.opret_medlem_med_login(:'md', 'Ole', true) as ole \gset
select tests.regel(:'ole', 'Leje', 100, 'maaned', 15, array[:'ole']::uuid[]) as leje \gset
select private.koer_automatik('2026-03-14 12:00 Europe/Copenhagen');
select private.koer_automatik('2026-03-15 12:00 Europe/Copenhagen');
select private.koer_automatik('2026-03-16 12:00 Europe/Copenhagen');
select private.koer_automatik('2026-04-15 00:00 Europe/Copenhagen');
select results_eq(format($$ select * from tests.betalt(%L) $$, :'leje'),
  $$ values ('Ole', '2026-03-15'::date, 100), ('Ole', '2026-04-15'::date, 100) $$,
  'a monthly rule charges on its day of the month');

-- ---------- Nothing in a Pause ----------
select tests.kasse_fra_januar('Pause') as pause \gset
select tests.opret_medlem_med_login(:'pause', 'Pia', true) as pia \gset
select tests.regel(:'pia', 'Pia', 10, 'maaned', 1, array[:'pia']::uuid[]) as pause_regel \gset
update public.saeson set slutdato = '2026-02-28' where bodekasse_id = :'pause';
select private.koer_automatik('2026-03-01 12:00 Europe/Copenhagen');
select is_empty(format($$ select 1 from public.gebyr where tilbagevendende_id = %L $$, :'pause_regel'),
  'no charge on a day in a Pause');

-- ---------- Udmeldte are skipped, and nothing is charged for the gap ----------
select tests.kasse_fra_januar('Udmeldt') as udm \gset
select tests.opret_medlem_med_login(:'udm', 'Rie', true) as rie \gset
select tests.opret_medlem(:'udm', 'Sif') as sif \gset
select tests.regel(:'rie', 'Kaffe', 5, 'uge', 1, array[:'rie', :'sif']::uuid[]) as kaffe \gset
select private.koer_automatik('2026-03-09 12:00 Europe/Copenhagen');
update public.medlem set udmeldt = '2026-03-10 12:00 Europe/Copenhagen' where id = :'sif';
select private.koer_automatik('2026-03-16 12:00 Europe/Copenhagen');
select private.koer_automatik('2026-03-23 12:00 Europe/Copenhagen');
update public.medlem set udmeldt = null where id = :'sif';   -- brought back
select private.koer_automatik('2026-03-29 22:30+00');          -- Monday 30 March
select results_eq(format($$ select * from tests.betalt(%L) where navn = 'Sif' $$, :'kaffe'),
  $$ values ('Sif', '2026-03-09'::date, 5), ('Sif', '2026-03-30'::date, 5) $$,
  'an Udmeldt Medlem pays nothing, and once brought back pays from then on, not for the gap');
select is((select count(*)::int from public.gebyr where tilbagevendende_id = :'kaffe' and medlem_id = :'rie'), 4,
  'the others still pay every week');

-- ---------- A missed occurrence catches up (spec #74 review) ----------
-- Spec #74: "A missed run catches up on the next one." Each run also charges
-- occurrences of the last 7 local days (today and the 6 before) that are
-- still uncharged, each by its own day's rules: a Sæson running at its start,
-- the rule unchanged since before it and not stopped during it, and the
-- Medlem active on it. 2026-03-09 is a Monday; the first run is on Wednesday
-- 11 March, so Monday 2 March is too far back.
select tests.kasse_fra_januar('Glemt') as gl \gset
select tests.opret_medlem_med_login(:'gl', 'Gert', true) as gert \gset
select tests.opret_medlem(:'gl', 'Hanne') as hanne \gset
select tests.opret_medlem(:'gl', 'Ivan') as ivan \gset
select tests.regel(:'gert', 'Glemt', 10, 'uge', 1, array[:'gert', :'hanne', :'ivan']::uuid[]) as glemt \gset
-- Hanne was Udmeldt on 5 March and brought back on 10 March.
update public.medlem set udmeldt = null where id = :'hanne';
insert into public.haendelse (bodekasse_id, saeson_id, tid, art, modtager_id, ref_tabel, ref_id)
values (:'gl', private.seneste_saeson(:'gl'), '2026-03-05 12:00 Europe/Copenhagen',
        'medlem_udmeldt', :'hanne', 'medlem', :'hanne'),
       (:'gl', private.seneste_saeson(:'gl'), '2026-03-10 12:00 Europe/Copenhagen',
        'medlem_genoptaget', :'hanne', 'medlem', :'hanne');
-- Ivan was Udmeldt on 10 March, after the missed Monday.
update public.medlem set udmeldt = '2026-03-10 12:00 Europe/Copenhagen' where id = :'ivan';
insert into public.haendelse (bodekasse_id, saeson_id, tid, art, modtager_id, ref_tabel, ref_id)
values (:'gl', private.seneste_saeson(:'gl'), '2026-03-10 12:00 Europe/Copenhagen',
        'medlem_udmeldt', :'ivan', 'medlem', :'ivan');
-- Rules made, edited or stopped around the missed day.
select tests.regel(:'gert', 'Ny', 7, 'uge', 1, array[:'gert']::uuid[]) as gl_ny \gset
update public.tilbagevendende set aendret = '2026-03-10 08:00 Europe/Copenhagen' where id = :'gl_ny';
select tests.regel(:'gert', 'Stoppet', 7, 'uge', 1, array[:'gert']::uuid[]) as gl_stop \gset
update public.tilbagevendende set stoppet = '2026-03-09 15:00 Europe/Copenhagen', stoppet_af = :'gert'
 where id = :'gl_stop';
select tests.regel(:'gert', 'Stoppet efter', 7, 'uge', 1, array[:'gert']::uuid[]) as gl_efter \gset
update public.tilbagevendende set stoppet = '2026-03-10 15:00 Europe/Copenhagen', stoppet_af = :'gert'
 where id = :'gl_efter';

select private.koer_automatik('2026-03-11 09:00 Europe/Copenhagen');
select results_eq(format($$ select * from tests.betalt(%L) $$, :'glemt'),
  $$ values ('Gert', '2026-03-09'::date, 10), ('Ivan', '2026-03-09'::date, 10) $$,
  'a run catches up a missed occurrence within 7 days, for who was active on that day');
select results_eq(
  format($$ select distinct oprettet from public.gebyr where tilbagevendende_id = %L $$, :'glemt'),
  $$ values ('2026-03-09 00:00 Europe/Copenhagen'::timestamptz) $$,
  'the caught-up Gebyr is dated to the start of its own day');
select is_empty(format($$ select 1 from public.gebyr where tilbagevendende_id in (%L, %L) $$, :'gl_ny', :'gl_stop'),
  'a rule made after the missed day, or stopped during it, charges nothing for it');
select results_eq(format($$ select * from tests.betalt(%L) $$, :'gl_efter'),
  $$ values ('Gert', '2026-03-09'::date, 7) $$,
  'a rule stopped after the missed day still charges it');

select private.koer_automatik('2026-03-11 10:00 Europe/Copenhagen');
select is((select count(*)::int from public.gebyr where bodekasse_id = :'gl' and art = 'tilbagevendende'), 3,
  'catching up is idempotent');

-- A Pause on the missed day: the Sæson ended on 8 March, the next began on 10 March.
select tests.kasse_fra_januar('Glemt i pause') as glp \gset
select tests.opret_medlem_med_login(:'glp', 'Jens', true) as jens \gset
select tests.regel(:'jens', 'Pause', 10, 'uge', 1, array[:'jens']::uuid[]) as glp_regel \gset
update public.saeson set slutdato = '2026-03-08' where bodekasse_id = :'glp';
insert into public.saeson (bodekasse_id, navn, startet)
values (:'glp', 'Sæson 2', '2026-03-10 08:00 Europe/Copenhagen');
select private.koer_automatik('2026-03-11 09:00 Europe/Copenhagen');
select is_empty(format($$ select 1 from public.gebyr where tilbagevendende_id = %L $$, :'glp_regel'),
  'a missed day in a Pause is not caught up');

-- ---------- Admin only, and the fields are checked ----------
select tests.log_ind_som_medlem(:'bo');
select throws_ok(
  format($$ select public.opret_tilbagevendende(gen_random_uuid(), %L, 'X', 10, 'uge', 1, array[%L]::uuid[]) $$,
         :'uge', :'bo'),
  '42501', 'ikke_admin', 'a Medlem who is not Admin cannot create a rule');
select throws_ok(
  format($$ select public.ret_tilbagevendende(gen_random_uuid(), %L, 'X', 10, 'uge', 1, array[%L]::uuid[]) $$,
         :'kontingent', :'bo'),
  '42501', 'ikke_admin', 'nor edit one');
select throws_ok(format($$ select public.stop_tilbagevendende(gen_random_uuid(), %L) $$, :'kontingent'),
  '42501', 'ikke_admin', 'nor stop one');
select is((select count(*)::int from public.tilbagevendende where bodekasse_id = :'uge'), 1,
  'every Medlem can see the box''s rules');
select is((select count(*)::int from public.tilbagevendende_medlem where bodekasse_id = :'uge'), 2,
  'and who they hit');

select tests.log_ind_som_medlem(:'ole');
select throws_ok(format($$ select public.stop_tilbagevendende(gen_random_uuid(), %L) $$, :'kontingent'),
  '42501', 'ikke_medlem', 'an Admin of another box cannot touch the rule');
select is((select count(*)::int from public.tilbagevendende where bodekasse_id = :'uge'), 0,
  'nor see it');

select tests.log_ind_som_medlem(:'anna');
select throws_ok(
  format($$ select public.opret_tilbagevendende(gen_random_uuid(), %L, '  ', 10, 'uge', 1, array[%L]::uuid[]) $$, :'uge', :'bo'),
  'P0001', 'navn_mangler', 'a rule needs a name');
select throws_ok(
  format($$ select public.opret_tilbagevendende(gen_random_uuid(), %L, 'X', 0, 'uge', 1, array[%L]::uuid[]) $$, :'uge', :'bo'),
  'P0001', 'beloeb_ugyldig', 'and an amount above 0');
select throws_ok(
  format($$ select public.opret_tilbagevendende(gen_random_uuid(), %L, 'X', 10, 'uge', 8, array[%L]::uuid[]) $$, :'uge', :'bo'),
  'P0001', 'frekvens_ugyldig', 'a weekday is 1 to 7');
select throws_ok(
  format($$ select public.opret_tilbagevendende(gen_random_uuid(), %L, 'X', 10, 'maaned', 29, array[%L]::uuid[]) $$, :'uge', :'bo'),
  'P0001', 'frekvens_ugyldig', 'a day of the month is 1 to 28');
select throws_ok(
  format($$ select public.opret_tilbagevendende(gen_random_uuid(), %L, 'X', 10, 'uge', 1, '{}'::uuid[]) $$, :'uge'),
  'P0001', 'medlemmer_mangler', 'a rule hits at least one Medlem');
select throws_ok(
  format($$ select public.opret_tilbagevendende(gen_random_uuid(), %L, 'X', 10, 'uge', 1, array[%L]::uuid[]) $$, :'uge', :'ole'),
  'P0001', 'medlem_ukendt', 'only Medlemmer of the box');

select gen_random_uuid() as en_gang \gset
select public.opret_tilbagevendende(:'en_gang', :'uge', 'Øl', 15, 'maaned', 3, array[:'bo', :'bo']::uuid[])
  ->> 'tilbagevendende_id' as oel \gset
select is(public.opret_tilbagevendende(:'en_gang', :'uge', 'Øl', 15, 'maaned', 3, array[:'bo']::uuid[])
            ->> 'tilbagevendende_id', :'oel',
  'a repeat of the one-time ID creates nothing new');
select results_eq(
  format($$ select r.navn, r.beloeb, r.frekvens::text, r.dag, r.oprettet_af, r.stoppet,
                   (select array_agg(medlem_id) from public.tilbagevendende_medlem where tilbagevendende_id = r.id)
              from public.tilbagevendende r where r.id = %L $$, :'oel'),
  format($$ values ('Øl', 15, 'maaned', 3, %L::uuid, null::timestamptz, array[%L]::uuid[]) $$, :'anna', :'bo'),
  'an Admin creates a rule with its name, amount, frequency and Medlemmer');
select tests.log_ud();

-- ---------- Edits affect only future occurrences ----------
-- Its own box, in May (no earlier run touched these dates). 2026-05-04 is a
-- Monday. It is charged at 00:00; at noon the Admin raises the amount and
-- swaps Dan for Finn.
select tests.kasse_fra_januar('Ret') as ret \gset
select tests.opret_medlem_med_login(:'ret', 'Dan', true) as dan \gset
select tests.opret_medlem(:'ret', 'Eva') as eva \gset
select tests.opret_medlem(:'ret', 'Finn') as finn \gset
select tests.regel(:'dan', 'Bane', 20, 'uge', 1, array[:'dan', :'eva']::uuid[]) as bane \gset
select private.koer_automatik('2026-05-04 00:00 Europe/Copenhagen');

select tests.log_ind_som_medlem(:'dan');
select is(public.ret_tilbagevendende(gen_random_uuid(), :'bane', ' Banen ', 30, 'uge', 1,
                                     array[:'eva', :'finn']::uuid[]),
  '{}'::jsonb, 'an Admin edits a rule');
select tests.log_ud();
select results_eq(
  format($$ select r.navn, r.beloeb,
                   (select array_agg(medlem_id order by medlem_id) from public.tilbagevendende_medlem
                     where tilbagevendende_id = r.id)
              from public.tilbagevendende r where r.id = %L $$, :'bane'),
  format($$ values ('Banen', 30, (select array_agg(id order by id) from unnest(array[%L, %L]::uuid[]) id)) $$,
         :'eva', :'finn'),
  'the edit replaces the name, amount and Medlemmer');
update public.tilbagevendende set aendret = '2026-05-04 12:00 Europe/Copenhagen' where id = :'bane';

select private.koer_automatik('2026-05-04 13:00 Europe/Copenhagen');
select results_eq(format($$ select * from tests.betalt(%L) $$, :'bane'),
  $$ values ('Dan', '2026-05-04'::date, 20), ('Eva', '2026-05-04'::date, 20) $$,
  'an edit leaves the occurrence already due untouched, and adds nobody to it');
select private.koer_automatik('2026-05-11 00:00 Europe/Copenhagen');
select results_eq(format($$ select * from tests.betalt(%L) where udloeser = '2026-05-11' $$, :'bane'),
  $$ values ('Eva', '2026-05-11'::date, 30), ('Finn', '2026-05-11'::date, 30) $$,
  'the next occurrence uses the edited amount and Medlemmer');

-- A rule created during a day first charges on the next occurrence. (Runs
-- stay before 18 May: a later run would catch up that Monday of 'Bane'.)
select tests.regel(:'dan', 'Ny', 7, 'uge', 2, array[:'eva']::uuid[]) as ny \gset
update public.tilbagevendende set aendret = '2026-05-05 08:00 Europe/Copenhagen' where id = :'ny';
select private.koer_automatik('2026-05-05 09:00 Europe/Copenhagen');
select private.koer_automatik('2026-05-12 00:00 Europe/Copenhagen');
select results_eq(format($$ select * from tests.betalt(%L) $$, :'ny'),
  $$ values ('Eva', '2026-05-12'::date, 7) $$,
  'a rule made on an occurrence day starts with the next one');

-- ---------- An annulled occurrence is never charged again ----------
select tests.log_ind_som_medlem(:'dan');
select public.annuller_gebyr(gen_random_uuid(),
  (select id from public.gebyr where tilbagevendende_id = :'bane' and medlem_id = :'finn'),
  'Finn var bortrejst');
select tests.log_ud();
select is((select annulleret is not null from public.aktivitet
            where art = 'tilbagevendende' and modtager_id = :'finn'), true,
  'an Admin can annul an occurrence, and its feed entry shows it annulled');
select results_eq(
  format($$ select data->>'art', data->>'navn', (data->>'beloeb')::int from public.haendelse
             where art = 'gebyr_annulleret' and modtager_id = %L $$, :'finn'),
  $$ values ('tilbagevendende', 'Banen', 30) $$,
  'the annulment names the rule');
select private.koer_automatik('2026-05-11 18:00 Europe/Copenhagen');
select results_eq(
  format($$ select count(*)::int, count(annulleret)::int from public.gebyr
             where tilbagevendende_id = %L and medlem_id = %L $$, :'bane', :'finn'),
  $$ values (1, 1) $$,
  'later runs charge nothing again');

-- ---------- Stop ----------
select tests.log_ind_som_medlem(:'dan');
select is(public.stop_tilbagevendende(gen_random_uuid(), :'bane'), '{}'::jsonb,
  'an Admin stops a rule');
select is(public.stop_tilbagevendende(gen_random_uuid(), :'bane'), '{}'::jsonb,
  'stopping it again changes nothing');
select throws_ok(
  format($$ select public.ret_tilbagevendende(gen_random_uuid(), %L, 'X', 10, 'uge', 1, array[%L]::uuid[]) $$,
         :'bane', :'eva'),
  'P0001', 'tilbagevendende_stoppet', 'a stopped rule cannot be edited');
select tests.log_ud();
select private.koer_automatik('2026-05-18 00:00 Europe/Copenhagen');
select results_eq(
  format($$ select count(*)::int, count(annulleret)::int, max(udloeser) from public.gebyr
             where tilbagevendende_id = %L $$, :'bane'),
  $$ values (4, 1, '2026-05-11'::date) $$,
  'a stopped rule charges nothing more, and what it charged stays');

select * from finish();
rollback;
