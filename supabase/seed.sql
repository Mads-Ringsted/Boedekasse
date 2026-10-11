-- Local fake data only (`supabase db reset`). Never pushed to production.
-- Box "FC Ølhunde" with the sample Medlemmer and Bødekategorier from
-- docs/design/v1-screens-brief.md and the placeholders in v1-design-decisions.md.
--
-- Log in locally as any seeded email except Sebastian's: request a code in the
-- app, then read it in the mail catcher at http://127.0.0.1:54324.

-- Confirmed logins for everyone but Sebastian (not logged in yet). The token
-- columns must be '' (not null) or the auth server fails to load the user.
insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                        confirmation_token, recovery_token, email_change_token_new,
                        email_change, email_change_token_current, reauthentication_token)
select gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated',
       'authenticated', email, now(), '{"provider":"email","providers":["email"]}', '{}',
       now(), now(), '', '', '', '', '', ''
  from (values ('mads@example.com'), ('jonas@example.com'), ('frederik@example.com'),
               ('oliver@example.com'), ('emil@example.com'), ('kasper@example.com'),
               ('lucas@example.com')) u(email);

insert into public.bodekasse (id, navn, mobilepay_box)
values ('0e1a0000-0000-4000-8000-000000000001', 'FC Ølhunde', '1234 5678');

insert into public.bodekasse_kode (bodekasse_id, kode)
values ('0e1a0000-0000-4000-8000-000000000001', 'K7P2QX');

insert into public.saeson (bodekasse_id, navn)
values ('0e1a0000-0000-4000-8000-000000000001',
        'Sæson ' || extract(year from now() at time zone 'Europe/Copenhagen'));

-- The claim trigger links each Medlem to the login with the same email.
insert into public.medlem (bodekasse_id, navn, email, er_admin)
select '0e1a0000-0000-4000-8000-000000000001', navn, email, er_admin
  from (values ('Mads Ringsted',   'mads@example.com',      true),
               ('Jonas Holm',      'jonas@example.com',     false),
               ('Frederik Lund',   'frederik@example.com',  true),
               ('Oliver Krogh',    'oliver@example.com',    false),
               ('Emil Bach',       'emil@example.com',      false),
               ('Kasper Nørgaard', 'kasper@example.com',    false),
               ('Lucas Berg',      'lucas@example.com',     false),
               ('Sebastian Juhl',  'sebastian@example.com', false)) m(navn, email, er_admin);

insert into public.bodekategori (bodekasse_id, navn, pris, beskrivelse, oprettet_af)
select m.bodekasse_id, k.navn, k.pris, k.beskrivelse, m.id
  from public.medlem m
 cross join (values
   ('For sent',                   50, 'Kommer efter aftalt mødetid.'),
   ('Telefon ved bordet',         20, null),
   ('Bandeord',                   10, null),
   ('Spildt drikke',              20, null),
   ('Hygge i stedet for træning', 40, null),
   ('Ikke drukket op',            30, null),
   ('Glemt udstyr',               25, null),
   ('Glemt at melde afbud',       30, null),
   ('Gult kort',                  40, null),
   ('Glemt kage på fødselsdag',  100, null)) k(navn, pris, beskrivelse)
 where m.email = 'mads@example.com';
