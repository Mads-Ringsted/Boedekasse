import { linjeTekst } from '../../giv/tekst.ts';
import { formatKr, t } from '../../strings/index.ts';
import type { Boede } from '../haendelse.ts';
import { hvem, hvemObjekt } from '../navne.ts';
import type { Beskriver, BoedeLinje, Tag } from '../visning.ts';

const dansk = new Intl.Collator('da', { sensitivity: 'base', numeric: true });

/** A Bøde's status tag: Annulleret, Anket, Afgørelse ændret, Anke vundet or Anke tabt. */
export function boedeTag(b: Boede): Tag | undefined {
  if (b.annullering) return { tekst: t('boede.tag.annulleret'), tone: 'graa' };
  if (b.anket) return { tekst: t('boede.tag.anket'), tone: 'advarsel' };
  if (!b.afgoerelse) return undefined;
  if (b.afgoerelseAendret) return { tekst: t('boede.tag.aendret'), tone: 'blaa' };
  return b.afgoerelse === 'modtager_vandt'
    ? { tekst: t('boede.tag.vundet'), tone: 'groen' }
    : { tekst: t('boede.tag.tabt'), tone: 'graa' };
}

const plusGebyr = (beloeb: number) => (beloeb > 0 ? t('aktivitet.plusGebyr', { beloeb: formatKr(beloeb) }) : undefined);

/** "2× For sent, Spildt drikke": the Bøder counted by name, A–Å. */
function opsummering(boeder: readonly Boede[]): string {
  const antal = new Map<string, number>();
  for (const b of boeder) antal.set(b.navn, (antal.get(b.navn) ?? 0) + 1);
  const linjer = [...antal].map(([navn, n]) => ({ navn, antal: n }));
  return linjeTekst(linjer.sort((a, b) => dansk.compare(a.navn, b.navn)));
}

/**
 * 'boeder_givet': one row per receiver per Giv batch (#53).
 * The amount counts the Bøder still standing; when all are annulled the row
 * is struck through with the full amount. One Bøde opens on tap; two or more
 * expand.
 */
export const boederGivet: Beskriver = (h, ctx) => {
  const boeder = h.boeder;
  const [foerste] = boeder;
  if (!foerste) return null;

  const giver = hvem(h.aktoerId, h.aktoerNavn, ctx);
  const modtager = hvemObjekt(h.modtagerId, h.modtagerNavn, ctx);
  const titel =
    boeder.length > 1
      ? t('aktivitet.gavBoeder', { giver, modtager, antal: boeder.length })
      : foerste.engangsbode
        ? t('aktivitet.gavEngangsboede', { giver, modtager })
        : t('aktivitet.gavBoede', { giver, modtager });

  const staar = boeder.filter((b) => !b.annullering);
  const alleAnnulleret = staar.length === 0;
  const sum = (liste: readonly Boede[], felt: 'pris' | 'gebyr') => liste.reduce((s, b) => s + b[felt], 0);

  let tag: Tag | undefined;
  if (boeder.length === 1) tag = boedeTag(foerste);
  else if (alleAnnulleret) tag = { tekst: t('boede.tag.annulleret'), tone: 'graa' };
  else if (staar.some((b) => b.anket)) tag = { tekst: t('boede.tag.anket'), tone: 'advarsel' };

  const dele = [opsummering(boeder)];
  const annulleretAf = new Set(boeder.map((b) => b.annullering?.afNavn));
  if (alleAnnulleret && annulleretAf.size === 1) {
    dele.push(t('aktivitet.annulleretAf', { navn: hvemObjekt(foerste.annullering?.afId ?? null, foerste.annullering?.afNavn ?? null, ctx) }));
  }

  return {
    ikon: { slags: 'avatar', navn: h.modtagerNavn ?? '', egen: h.modtagerId === ctx.migId },
    titel,
    tag,
    linje: dele.join(' · '),
    beloeb: { tekst: formatKr(sum(alleAnnulleret ? boeder : staar, 'pris')) },
    gebyr: plusGebyr(sum(staar, 'gebyr')),
    annulleret: alleAnnulleret,
    ...(boeder.length > 1
      ? {
          boeder: boeder.map(
            (b): BoedeLinje => ({
              id: b.id,
              navn: b.navn,
              beloeb: formatKr(b.pris),
              tag: boedeTag(b),
              annulleret: b.annullering !== null,
              gebyr: b.annullering ? undefined : plusGebyr(b.gebyr),
            }),
          ),
        }
      : { boedeId: foerste.id }),
  };
};
