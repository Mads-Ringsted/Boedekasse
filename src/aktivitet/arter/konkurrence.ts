import { vindere } from '../../konkurrence/konkurrence.ts';
import { formatKr, t } from '../../strings/index.ts';
import { hvem, hvemObjekt } from '../navne.ts';
import type { Beskriver, Ikon } from '../visning.ts';
import { dataTal, dataTekst } from './faelles.ts';

// Konkurrence entries (#66). The live state is in `h.konkurrence`.
const ikon: Ikon = { slags: 'symbol', symbol: 'trofae', tone: 'blaa' };
const link = (id: string) => `/konkurrencer/${id}`;

/**
 * 'konkurrence_registreret' {titel}: one grouped row, "Konkurrence: Bowling ·
 * Frederik vandt · 8 gebyrer · 260 kr", tagged "Rettet af X" once corrected.
 * In a Medlem's history: "Bowling · Konkurrence · 3. plads · 25 kr".
 */
export const konkurrenceRegistreret: Beskriver = (h, ctx) => {
  const k = h.konkurrence;
  if (!k) return null;
  const tag = k.rettetAf
    ? { tekst: t('konkurrence.rettetAf', { navn: hvemObjekt(k.rettetAf, k.rettetAfNavn, ctx) }), tone: 'blaa' as const }
    : undefined;

  const deltager = ctx.profilId ? k.resultat.find((d) => d.medlemId === ctx.profilId) : undefined;
  if (deltager) {
    return {
      ikon,
      titel: k.titel,
      tag,
      linje: t('konkurrence.profilLinje', {
        plads: deltager.plads === null ? t('konkurrence.fravaerende') : t('konkurrence.plads', { plads: deltager.plads }),
      }),
      beloeb: { tekst: formatKr(deltager.beloeb) },
      annulleret: false,
      link: link(k.id),
    };
  }

  const navne = vindere(k).map((d) => hvem(d.medlemId, d.navn, ctx));
  const dele = [
    navne.length > 0 ? t('konkurrence.vandt', { navne: navne.join(t('konkurrence.og')) }) : '',
    k.antalGebyrer === 1 ? t('konkurrence.etGebyr') : t('konkurrence.antalGebyrer', { antal: k.antalGebyrer }),
  ];
  return {
    ikon,
    titel: t('konkurrence.feedTitel', { titel: k.titel }),
    tag,
    linje: dele.filter(Boolean).join(' · '),
    beloeb: { tekst: formatKr(k.total) },
    annulleret: false,
    link: link(k.id),
  };
};

/** 'konkurrence_annulleret' {titel, beloeb, konkurrence_id}: the new entry at the top. */
export const konkurrenceAnnulleret: Beskriver = (h, ctx) => {
  const id = dataTekst(h, 'konkurrence_id');
  return {
    ikon,
    titel: t('konkurrence.annulleretFeed', { hvem: hvem(h.aktoerId, h.aktoerNavn, ctx), titel: dataTekst(h, 'titel') }),
    linje: t('konkurrence.annulleretLinje', { beloeb: formatKr(dataTal(h, 'beloeb')) }),
    annulleret: false,
    ...(id ? { link: link(id) } : {}),
  };
};
