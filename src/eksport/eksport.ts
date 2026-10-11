import { t, type PlainStringId } from '../strings/index.ts';
import type { Database } from '../supabase/database.types.ts';

type GebyrArt = Database['public']['Enums']['gebyr_art'];

/** One row of `eksport_saeson`: a Bøde, Gebyr, Indbetaling or Hævning. */
export interface EksportRaekke {
  tid: string;
  art: string;
  gebyr_art: GebyrArt | null;
  medlem: string | null;
  af: string | null;
  hvad: string | null;
  beloeb: number;
  anke: string | null;
  annulleret: string | null;
  annulleret_note: string | null;
}

const KOLONNER: PlainStringId[] = [
  'eksport.kol.dato',
  'eksport.kol.type',
  'eksport.kol.medlem',
  'eksport.kol.af',
  'eksport.kol.hvad',
  'eksport.kol.beloeb',
  'eksport.kol.anke',
  'eksport.kol.annulleret',
  'eksport.kol.annulleringsnote',
];

const ART: Record<string, PlainStringId> = {
  bode: 'eksport.art.bode',
  engangsbode: 'eksport.art.engangsbode',
  indbetaling: 'eksport.art.indbetaling',
  haevning: 'eksport.art.haevning',
};

const GEBYR: Record<GebyrArt, PlainStringId> = {
  oprettelse: 'eksport.gebyr.oprettelse',
  engangsbode: 'eksport.gebyr.engangsbode',
  anke: 'eksport.gebyr.anke',
  frikob: 'eksport.gebyr.frikob',
  placering: 'eksport.gebyr.placering',
  fravaer: 'eksport.gebyr.fravaer',
};

const ANKE: Record<string, PlainStringId> = {
  afventer: 'eksport.anke.afventer',
  modtager_vandt: 'eksport.anke.modtagerVandt',
  giver_vandt: 'eksport.anke.giverVandt',
  ikke_afgjort: 'eksport.anke.ikkeAfgjort',
};

const dansk = new Intl.DateTimeFormat('da-DK', {
  timeZone: 'Europe/Copenhagen',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** "2026-03-02 10:00" in Danish time: Excel and Numbers read it as a date. */
function tidspunkt(iso: string | null): string {
  if (!iso) return '';
  const del = Object.fromEntries(dansk.formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  return `${del.year}-${del.month}-${del.day} ${del.hour}:${del.minute}`;
}

/**
 * Free text as one CSV field. Text that Excel would run as a formula gets a
 * leading apostrophe; text with a separator, quote or line break is quoted.
 */
function felt(tekst: string | null): string {
  let v = tekst ?? '';
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  return /[;"\r\n]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v;
}

function type(r: EksportRaekke): string {
  const id = r.gebyr_art ? GEBYR[r.gebyr_art] : ART[r.art];
  return id ? t(id) : r.art;
}

/**
 * The CSV file for one Sæson. Semicolons and a UTF-8 byte-order mark, so
 * Danish Excel splits the columns and shows æ, ø and å; Numbers reads it too.
 * Amounts are plain whole kroner, so they can be summed.
 */
export function eksportCsv(raekker: EksportRaekke[]): string {
  const linjer = [KOLONNER.map((id) => t(id)).join(';')];
  for (const r of raekker) {
    linjer.push(
      [
        tidspunkt(r.tid),
        felt(type(r)),
        felt(r.medlem),
        felt(r.af),
        felt(r.hvad),
        String(r.beloeb),
        r.anke && ANKE[r.anke] ? t(ANKE[r.anke]) : '',
        tidspunkt(r.annulleret),
        felt(r.annulleret_note),
      ].join(';'),
    );
  }
  return `﻿${linjer.join('\r\n')}`;
}

/** "FC Ølhunde - Sæson 2026.csv", without characters a file name can't hold. */
export function eksportFilnavn(bodekasse: string, saeson: string): string {
  return `${bodekasse} - ${saeson}.csv`.replace(/[/\\:*?"<>|]/g, '-');
}
