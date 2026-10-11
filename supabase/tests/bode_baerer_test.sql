-- Who bears a Bøde comes from its Anke:
-- no Anke -> receiver; pending -> nobody; modtager_vandt -> giver;
-- giver_vandt / ikke_afgjort -> receiver. Annulled -> nobody.
begin;
\ir _hjaelpere.psql
select plan(8);

select tests.opret_bodekasse() as kasse \gset
select tests.opret_medlem_med_login(:'kasse', 'Giver') as giver \gset
select tests.opret_medlem_med_login(:'kasse', 'Modtager') as modtager \gset

select tests.giv_bode(:'giver', :'modtager') as uden_anke \gset
select tests.giv_bode(:'giver', :'modtager') as anket \gset
select tests.anke(:'anket') as a1 \gset
select tests.giv_bode(:'giver', :'modtager') as modtager_vandt \gset
select tests.anke(:'modtager_vandt', 'modtager_vandt') as a2 \gset
select tests.giv_bode(:'giver', :'modtager') as giver_vandt \gset
select tests.anke(:'giver_vandt', 'giver_vandt') as a3 \gset
select tests.giv_bode(:'giver', :'modtager') as ikke_afgjort \gset
select tests.anke(:'ikke_afgjort', 'ikke_afgjort') as a4 \gset
select tests.giv_bode(:'giver', :'modtager') as annulleret \gset
update public.bode set annulleret = now(), annulleret_af = :'giver' where id = :'annulleret';
select tests.giv_bode(:'giver', :'modtager') as annulleret_anket \gset
select tests.anke(:'annulleret_anket') as a5 \gset
update public.bode set annulleret = now(), annulleret_af = :'giver' where id = :'annulleret_anket';

select tests.log_ind_som_medlem(:'modtager');

select is((select baerer_id from public.bode_baerer where id = :'uden_anke'), :'modtager'::uuid,
  'with no Anke the receiver bears the Bøde');
select is((select baerer_id from public.bode_baerer where id = :'anket'), null,
  'while the Anke is pending nobody bears the Bøde');
select is((select anket from public.bode_baerer where id = :'anket'), true,
  'a pending Anke shows the Bøde as anket');
select is((select baerer_id from public.bode_baerer where id = :'modtager_vandt'), :'giver'::uuid,
  'when the receiver wins the Anke the giver bears the Bøde');
select is((select baerer_id from public.bode_baerer where id = :'giver_vandt'), :'modtager'::uuid,
  'when the giver wins the Anke the receiver bears the Bøde');
select is((select baerer_id from public.bode_baerer where id = :'ikke_afgjort'), :'modtager'::uuid,
  'an undecided Anke leaves the Bøde with the receiver');
select is((select baerer_id from public.bode_baerer where id = :'annulleret'), null,
  'an annulled Bøde is borne by nobody');
select is((select baerer_id from public.bode_baerer where id = :'annulleret_anket'), null,
  'an annulled Bøde with a pending Anke is borne by nobody');

select * from finish();
rollback;
