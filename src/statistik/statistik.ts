import { aften, DAG_MS, lokal, mandag, plusDage, ugeNr } from './tid.ts';

/**
 * The Statistik tab's numbers, worked out from one Sæson's records. Every
 * function here is pure; `hentStatistik.ts` loads the records.
 */

/** One Bøde (not annulled) as the stats need it. */
export interface StatBoede {
  id: string;
  giverId: string;
  modtagerId: string;
  /** Who bears it now: the giver after a won Anke. */
  baererId: string;
  /** Null for an Engangsbøde. */
  kategoriId: string | null;
  pris: number;
  givet: string;
  anket: boolean;
  afgoerelse: 'modtager_vandt' | 'giver_vandt' | 'ikke_afgjort' | null;
}

export interface StatMedlem {
  id: string;
  navn: string;
  udmeldt: boolean;
}

/** A charge on a Medlem's Saldo (Bøde borne or Gebyr) or an Indbetaling. */
export interface Beloeb {
  medlemId: string;
  beloeb: number;
  tid: string;
}

/** Medlem id → a number, with helpers to rank. */
type Taelling = Map<string, number>;

function tael<T>(liste: readonly T[], noegle: (x: T) => string | null, vaerdi: (x: T) => number = () => 1): Taelling {
  const m: Taelling = new Map();
  for (const x of liste) {
    const k = noegle(x);
    if (k !== null) m.set(k, (m.get(k) ?? 0) + vaerdi(x));
  }
  return m;
}

const sum = (boeder: readonly StatBoede[]) => boeder.reduce((n, b) => n + b.pris, 0);

// ---------- Dig ----------

export interface AntalKr {
  antal: number;
  kr: number;
}

/** Fået (given to you) and Givet (given by you). */
export function digTal(boeder: readonly StatBoede[], migId: string): { faaet: AntalKr; givet: AntalKr } {
  const faaet = boeder.filter((b) => b.modtagerId === migId);
  const givet = boeder.filter((b) => b.giverId === migId);
  return { faaet: { antal: faaet.length, kr: sum(faaet) }, givet: { antal: givet.length, kr: sum(givet) } };
}

/** How giving compares with getting, for the line under the split bar. */
export type Forhold =
  | { art: 'ingen' }
  | { art: 'lige' }
  | { art: 'giverFlere'; gange: number }
  | { art: 'faarFlere'; gange: number }
  | { art: 'kunGivet' }
  | { art: 'kunFaaet' };

export function forhold(givet: number, faaet: number): Forhold {
  if (givet === 0 && faaet === 0) return { art: 'ingen' };
  if (faaet === 0) return { art: 'kunGivet' };
  if (givet === 0) return { art: 'kunFaaet' };
  if (givet === faaet) return { art: 'lige' };
  const gange = Math.round((Math.max(givet, faaet) / Math.min(givet, faaet)) * 10) / 10;
  return givet > faaet ? { art: 'giverFlere', gange } : { art: 'faarFlere', gange };
}

/** What passed between you and one other Medlem. */
export interface Modpart {
  medlemId: string;
  /** Bøder you gave them. */
  gav: number;
  gavKr: number;
  /** Bøder they gave you. */
  fik: number;
  fikKr: number;
}

/**
 * One row per other Medlem: every active one, and Udmeldte with any Bøde
 * between you. Most given first, then most received.
 */
export function modparter(boeder: readonly StatBoede[], medlemmer: readonly StatMedlem[], migId: string): Modpart[] {
  const rk = new Map<string, Modpart>();
  const raekke = (id: string) => {
    let r = rk.get(id);
    if (!r) rk.set(id, (r = { medlemId: id, gav: 0, gavKr: 0, fik: 0, fikKr: 0 }));
    return r;
  };
  for (const m of medlemmer) if (!m.udmeldt && m.id !== migId) raekke(m.id);
  for (const b of boeder) {
    if (b.giverId === migId && b.modtagerId !== migId) {
      const r = raekke(b.modtagerId);
      r.gav += 1;
      r.gavKr += b.pris;
    } else if (b.modtagerId === migId && b.giverId !== migId) {
      const r = raekke(b.giverId);
      r.fik += 1;
      r.fikKr += b.pris;
    }
  }
  const navn = new Map(medlemmer.map((m) => [m.id, m.navn]));
  return [...rk.values()].sort(
    (a, b) => b.gav - a.gav || b.fik - a.fik || (navn.get(a.medlemId) ?? '').localeCompare(navn.get(b.medlemId) ?? '', 'da'),
  );
}

/** Your Nemesis: who gave you most Bøder (then most kr). Null when nobody did. */
export function nemesis(parter: readonly Modpart[]): Modpart | null {
  const top = [...parter].sort((a, b) => b.fik - a.fik || b.fikKr - a.fikKr)[0];
  return top && top.fik > 0 ? top : null;
}

/** Your Skydeskive: who you gave most Bøder (then most kr). Null when you gave none. */
export function skydeskive(parter: readonly Modpart[]): Modpart | null {
  const top = [...parter].sort((a, b) => b.gav - a.gav || b.gavKr - a.gavKr)[0];
  return top && top.gav > 0 ? top : null;
}

/** Your Engel: an active Medlem who never gave you a Bøde (the one you fined most). */
export function engel(parter: readonly Modpart[], medlemmer: readonly StatMedlem[]): Modpart | null {
  const aktive = new Set(medlemmer.filter((m) => !m.udmeldt).map((m) => m.id));
  return parter.find((p) => aktive.has(p.medlemId) && p.fik === 0 && p.gav > 0) ?? null;
}

/** Våbenhvile: an active Medlem with no Bøder either way. */
export function vaabenhvile(parter: readonly Modpart[], medlemmer: readonly StatMedlem[]): Modpart | null {
  const aktive = new Set(medlemmer.filter((m) => !m.udmeldt).map((m) => m.id));
  return parter.find((p) => aktive.has(p.medlemId) && p.fik === 0 && p.gav === 0) ?? null;
}

/** The Bødekategori one Medlem gives another most (null = Engangsbøde), with its count. */
export function favorit(
  boeder: readonly StatBoede[],
  giverId: string,
  modtagerId: string,
): { kategoriId: string | null; antal: number } | null {
  const mine = boeder.filter((b) => b.giverId === giverId && b.modtagerId === modtagerId);
  const t = tael(mine, (b) => b.kategoriId ?? '');
  let bedst: { kategoriId: string | null; antal: number } | null = null;
  for (const [k, antal] of t) if (!bedst || antal > bedst.antal) bedst = { kategoriId: k || null, antal };
  return bedst;
}

/** The last time one Medlem gave another a Bøde, and how many of those were appealed. */
export function mellem(
  boeder: readonly StatBoede[],
  giverId: string,
  modtagerId: string,
): { seneste: string | null; anket: number; antal: number } {
  const mine = boeder.filter((b) => b.giverId === giverId && b.modtagerId === modtagerId);
  const seneste = mine.reduce<string | null>((s, b) => (s === null || Date.parse(b.givet) > Date.parse(s) ? b.givet : s), null);
  return { seneste, anket: mine.filter((b) => b.anket).length, antal: mine.length };
}

/** Per Bødekategori (null = Engangsbøder): how many you gave and got. */
export interface KategoriRaekke {
  kategoriId: string | null;
  gav: number;
  fik: number;
}

export function mineKategorier(boeder: readonly StatBoede[], migId: string): KategoriRaekke[] {
  const rk = new Map<string, KategoriRaekke>();
  for (const b of boeder) {
    const gav = b.giverId === migId;
    const fik = b.modtagerId === migId;
    if (!gav && !fik) continue;
    const k = b.kategoriId ?? '';
    let r = rk.get(k);
    if (!r) rk.set(k, (r = { kategoriId: b.kategoriId, gav: 0, fik: 0 }));
    if (gav) r.gav += 1;
    if (fik) r.fik += 1;
  }
  return [...rk.values()].sort((a, b) => b.gav + b.fik - (a.gav + a.fik) || b.gav - a.gav);
}

/** Who gives you Bøder, most first (for the simple bars on Dig). */
export function hvemGiverDig(parter: readonly Modpart[]): Modpart[] {
  return parter.filter((p) => p.fik > 0).sort((a, b) => b.fik - a.fik || b.fikKr - a.fikKr);
}

/** What you get Bøder for, most first (for the simple bars on Dig). */
export function detFaarDuFor(raekker: readonly KategoriRaekke[]): KategoriRaekke[] {
  return raekker.filter((r) => r.fik > 0).sort((a, b) => b.fik - a.fik);
}

// ---------- Holdet ----------

/** Bøder per Bødekategori (null = Engangsbøder), most first. */
export function mestGivne(boeder: readonly StatBoede[]): { kategoriId: string | null; antal: number }[] {
  return [...tael(boeder, (b) => b.kategoriId ?? '')]
    .map(([k, antal]) => ({ kategoriId: k || null, antal }))
    .sort((a, b) => b.antal - a.antal);
}

export interface Hvornaar {
  /** Monday first. */
  ugedage: number[];
  /** 00 to 23. */
  timer: number[];
  /** The weekday + hour with most Bøder. Null with no Bøder. */
  farligst: { ugedag: number; time: number; antal: number } | null;
}

export function hvornaar(boeder: readonly StatBoede[]): Hvornaar {
  const ugedage = Array<number>(7).fill(0);
  const timer = Array<number>(24).fill(0);
  const kombi = new Map<number, number>();
  for (const b of boeder) {
    const l = lokal(b.givet);
    ugedage[l.ugedag] += 1;
    timer[l.time] += 1;
    const k = l.ugedag * 24 + l.time;
    kombi.set(k, (kombi.get(k) ?? 0) + 1);
  }
  let farligst: Hvornaar['farligst'] = null;
  for (const [k, antal] of kombi) {
    if (!farligst || antal > farligst.antal) farligst = { ugedag: Math.floor(k / 24), time: k % 24, antal };
  }
  return { ugedage, timer, farligst };
}

/** Index of the largest value (first on a tie); -1 when all are 0. */
export function stoerst(tal: readonly number[]): number {
  let i = -1;
  tal.forEach((v, j) => {
    if (v > 0 && (i < 0 || v > tal[i])) i = j;
  });
  return i;
}

/** The top givers and receivers. */
export function topTre(boeder: readonly StatBoede[]): {
  givere: { medlemId: string; antal: number }[];
  modtagere: { medlemId: string; antal: number }[];
} {
  const rang = (t: Taelling) =>
    [...t].map(([medlemId, antal]) => ({ medlemId, antal })).sort((a, b) => b.antal - a.antal).slice(0, 3);
  return { givere: rang(tael(boeder, (b) => b.giverId)), modtagere: rang(tael(boeder, (b) => b.modtagerId)) };
}

export interface Uge {
  /** The week's Monday, `YYYY-MM-DD`. */
  mandag: string;
  nr: number;
  antal: number;
}

/** Every week from the Sæson's start to its end (or now), with its Bøder. */
export function perUge(boeder: readonly StatBoede[], start: string, slut: string): Uge[] {
  const foerste = mandag(lokal(start).dato);
  const sidste = mandag(lokal(slut).dato);
  const t = tael(boeder, (b) => mandag(lokal(b.givet).dato));
  const uger: Uge[] = [];
  for (let m = foerste; m <= sidste && uger.length < 200; m = plusDage(m, 7)) {
    uger.push({ mandag: m, nr: ugeNr(m), antal: t.get(m) ?? 0 });
  }
  return uger;
}

/** A Medlem's slice of a stacked bar; `medlemId` null is "Andre". */
export interface Stak {
  medlemId: string | null;
  antal: number;
}

export interface StabletUge {
  mandag: string;
  nr: number;
  stakke: Stak[];
  total: number;
}

export interface Stablet {
  /** The named Medlemmer, most first; Andre comes after them. */
  personer: string[];
  medAndre: boolean;
  uger: StabletUge[];
  /** Who got most of this Bødekategori over the weeks. */
  top: { medlemId: string; antal: number } | null;
}

/** The Bødekategorier given in the last `antalUger` weeks, most first: the chips. */
export function stakKategorier(boeder: readonly StatBoede[], slut: string, antalUger = 8): string[] {
  const fra = plusDage(mandag(lokal(slut).dato), -7 * (antalUger - 1));
  const nylige = boeder.filter((b) => b.kategoriId !== null && lokal(b.givet).dato >= fra);
  return mestGivne(nylige).map((r) => r.kategoriId as string);
}

/**
 * "Hvem får hvilke bøder": one Bødekategori (or 'alle' Bøder) over the last
 * weeks, stacked per Medlem who got it (the top 4 by name, the rest as Andre).
 */
export function stablet(
  boeder: readonly StatBoede[],
  kategoriId: string | 'alle',
  slut: string,
  antalUger = 8,
): Stablet {
  const sidste = mandag(lokal(slut).dato);
  const ugeListe = Array.from({ length: antalUger }, (_, i) => plusDage(sidste, -7 * (antalUger - 1 - i)));
  const mine = boeder.filter(
    (b) => (kategoriId === 'alle' || b.kategoriId === kategoriId) && lokal(b.givet).dato >= ugeListe[0],
  );
  const ialt = [...tael(mine, (b) => b.modtagerId)].sort((a, b) => b[1] - a[1]);
  const personer = ialt.slice(0, 4).map(([id]) => id);
  const medAndre = ialt.length > 4;
  const uger = ugeListe.map((m) => {
    const ugens = mine.filter((b) => mandag(lokal(b.givet).dato) === m);
    const t = tael(ugens, (b) => b.modtagerId);
    const stakke: Stak[] = personer.map((id) => ({ medlemId: id, antal: t.get(id) ?? 0 }));
    const andre = [...t].filter(([id]) => !personer.includes(id)).reduce((n, [, v]) => n + v, 0);
    if (medAndre) stakke.push({ medlemId: null, antal: andre });
    return { mandag: m, nr: ugeNr(m), stakke, total: ugens.length };
  });
  return { personer, medAndre, uger, top: ialt[0] ? { medlemId: ialt[0][0], antal: ialt[0][1] } : null };
}

/**
 * Sæsonens rivaleri: the pair who fined each other most, counting the smaller
 * side first (a real back-and-forth beats a one-way street).
 */
export function rivaleri(boeder: readonly StatBoede[]): { a: string; b: string; aTilB: number; bTilA: number } | null {
  const t = tael(
    boeder.filter((b) => b.giverId !== b.modtagerId),
    (b) => `${b.giverId}|${b.modtagerId}`,
  );
  let bedst: { a: string; b: string; aTilB: number; bTilA: number } | null = null;
  for (const [k, aTilB] of t) {
    const [a, b] = k.split('|');
    const bTilA = t.get(`${b}|${a}`) ?? 0;
    if (bTilA === 0 || aTilB < bTilA) continue;
    if (!bedst || bTilA > bedst.bTilA || (bTilA === bedst.bTilA && aTilB + bTilA > bedst.aTilB + bedst.bTilA)) {
      bedst = { a, b, aTilB, bTilA };
    }
  }
  return bedst;
}

// ---------- Barometer ----------

export interface BarometerPlads {
  medlemId: string;
  antal: number;
  /** When they last got it; null at 0. */
  seneste: string | null;
  /** 1–3 get the clown makeover (only with at least one); 0 for the rest. */
  klovn: 0 | 1 | 2 | 3;
}

/**
 * Every active Medlem (and Udmeldte who got one) by how many of one
 * Bødekategori they got. A tie goes to whoever reached the count first.
 */
export function barometer(
  boeder: readonly StatBoede[],
  kategoriId: string,
  medlemmer: readonly StatMedlem[],
): BarometerPlads[] {
  const mine = boeder
    .filter((b) => b.kategoriId === kategoriId)
    .sort((a, b) => Date.parse(a.givet) - Date.parse(b.givet));
  const pr = new Map<string, { antal: number; seneste: string | null; naaet: number }>();
  for (const m of medlemmer) if (!m.udmeldt) pr.set(m.id, { antal: 0, seneste: null, naaet: Infinity });
  for (const b of mine) {
    const p = pr.get(b.modtagerId) ?? { antal: 0, seneste: null, naaet: Infinity };
    p.antal += 1;
    p.seneste = b.givet;
    p.naaet = Date.parse(b.givet);
    pr.set(b.modtagerId, p);
  }
  const navn = new Map(medlemmer.map((m) => [m.id, m.navn]));
  return [...pr]
    .sort(
      ([ia, a], [ib, b]) =>
        b.antal - a.antal || a.naaet - b.naaet || (navn.get(ia) ?? '').localeCompare(navn.get(ib) ?? '', 'da'),
    )
    .map(([medlemId, p], i) => ({
      medlemId,
      antal: p.antal,
      seneste: p.seneste,
      klovn: (p.antal > 0 && i < 3 ? i + 1 : 0) as BarometerPlads['klovn'],
    }));
}

/**
 * Where each row sits on the thermometer, in px from the top: by count, with
 * at least `afstand[i]` below row i so nothing overlaps; squeezed up from the
 * bottom when the column is too short.
 */
export function placer(antal: readonly number[], hoejde: readonly number[], hoejdeIalt: number): number[] {
  const max = Math.max(1, ...antal);
  const tops = antal.map((a, i) => (1 - a / max) * (hoejdeIalt - hoejde[i]));
  for (let i = 1; i < tops.length; i++) tops[i] = Math.max(tops[i], tops[i - 1] + hoejde[i - 1]);
  for (let i = tops.length - 1; i >= 0; i--) {
    const loft = i === tops.length - 1 ? hoejdeIalt - hoejde[i] : tops[i + 1] - hoejde[i];
    tops[i] = Math.max(0, Math.min(tops[i], loft));
  }
  return tops.map((t) => Math.round(t));
}

// ---------- Rekorder ----------

/** The box's Bøder and Gebyrer added up over the Sæson: one point per day with a change. */
export function kassenOverTid(charges: readonly Beloeb[]): { tid: string; ialt: number }[] {
  const sorteret = [...charges].sort((a, b) => Date.parse(a.tid) - Date.parse(b.tid));
  const punkter: { tid: string; ialt: number }[] = [];
  let ialt = 0;
  for (const c of sorteret) {
    ialt += c.beloeb;
    const dato = lokal(c.tid).dato;
    const sidste = punkter[punkter.length - 1];
    if (sidste && lokal(sidste.tid).dato === dato) sidste.ialt = ialt;
    else punkter.push({ tid: c.tid, ialt });
  }
  return punkter;
}

/** The evening (06–06) with most kr in Bøder across the box. */
export function dyresteAften(boeder: readonly StatBoede[]): { aften: string; kr: number; antal: number } | null {
  const kr = tael(boeder, (b) => aften(b.givet), (b) => b.pris);
  const antal = tael(boeder, (b) => aften(b.givet));
  let bedst: { aften: string; kr: number; antal: number } | null = null;
  for (const [a, k] of kr) if (!bedst || k > bedst.kr) bedst = { aften: a, kr: k, antal: antal.get(a) ?? 0 };
  return bedst;
}

/** The most kr in Bøder one Medlem has had to bear in one day (06–06). */
export function dyresteDagForEn(
  boeder: readonly StatBoede[],
): { medlemId: string; aften: string; kr: number; antal: number } | null {
  const kr = tael(boeder, (b) => `${b.baererId}|${aften(b.givet)}`, (b) => b.pris);
  const antal = tael(boeder, (b) => `${b.baererId}|${aften(b.givet)}`);
  let bedst: { medlemId: string; aften: string; kr: number; antal: number } | null = null;
  for (const [k, v] of kr) {
    if (!bedst || v > bedst.kr) {
      const [medlemId, a] = k.split('|');
      bedst = { medlemId, aften: a, kr: v, antal: antal.get(k) ?? 0 };
    }
  }
  return bedst;
}

/** Most Bøder one Medlem got in one evening (06–06). */
export function flestPaaEnAften(boeder: readonly StatBoede[]): { medlemId: string; aften: string; antal: number } | null {
  const t = tael(boeder, (b) => `${b.modtagerId}|${aften(b.givet)}`);
  let bedst: { medlemId: string; aften: string; antal: number } | null = null;
  for (const [k, antal] of t) {
    if (!bedst || antal > bedst.antal) {
      const [medlemId, a] = k.split('|');
      bedst = { medlemId, aften: a, antal };
    }
  }
  return bedst;
}

/**
 * The longest stretch an active Medlem went without getting a Bøde, from the
 * Sæson's start, between Bøder, and up to `slut`. `iGang` when it still runs.
 */
export function laengstUden(
  boeder: readonly StatBoede[],
  medlemmer: readonly StatMedlem[],
  start: string,
  slut: string,
  saesonKoerer: boolean,
): { medlemId: string; dage: number; iGang: boolean } | null {
  let bedst: { medlemId: string; dage: number; iGang: boolean } | null = null;
  const s = Date.parse(start);
  const e = Date.parse(slut);
  for (const m of medlemmer) {
    if (m.udmeldt) continue;
    const tider = boeder
      .filter((b) => b.modtagerId === m.id)
      .map((b) => Date.parse(b.givet))
      .sort((a, b) => a - b);
    const punkter = [s, ...tider, e];
    for (let i = 1; i < punkter.length; i++) {
      const dage = Math.floor((punkter[i] - punkter[i - 1]) / DAG_MS);
      const iGang = saesonKoerer && i === punkter.length - 1;
      if (!bedst || dage > bedst.dage) bedst = { medlemId: m.id, dage, iGang };
    }
  }
  return bedst && bedst.dage > 0 ? bedst : null;
}

/**
 * Who pays fastest: each Medlem's Indbetalinger cover their charges oldest
 * first; the average wait in days, weighted by kr. Paying ahead counts as 0.
 * Only Medlemmer with at least one covered kr take part.
 */
export function hurtigstTilAtBetale(
  charges: readonly Beloeb[],
  indbetalinger: readonly Beloeb[],
): { medlemId: string; dage: number } | null {
  const ids = new Set(indbetalinger.map((i) => i.medlemId));
  let bedst: { medlemId: string; dage: number } | null = null;
  for (const id of ids) {
    const koe = charges
      .filter((c) => c.medlemId === id && c.beloeb > 0)
      .map((c) => ({ tid: Date.parse(c.tid), rest: c.beloeb }))
      .sort((a, b) => a.tid - b.tid);
    const betalt = indbetalinger
      .filter((i) => i.medlemId === id && i.beloeb > 0)
      .map((i) => ({ tid: Date.parse(i.tid), rest: i.beloeb }))
      .sort((a, b) => a.tid - b.tid);
    let kr = 0;
    let krDage = 0;
    let ci = 0;
    for (const p of betalt) {
      while (p.rest > 0 && ci < koe.length) {
        const c = koe[ci];
        const del = Math.min(p.rest, c.rest);
        kr += del;
        krDage += del * Math.max(0, (p.tid - c.tid) / DAG_MS);
        p.rest -= del;
        c.rest -= del;
        if (c.rest === 0) ci++;
      }
    }
    if (kr === 0) continue;
    const dage = Math.round((krDage / kr) * 10) / 10;
    if (!bedst || dage < bedst.dage) bedst = { medlemId: id, dage };
  }
  return bedst;
}

/** Anke-kongen: the best share of decided Anker won (then most won). Needs one win. */
export function ankeKongen(boeder: readonly StatBoede[]): { medlemId: string; vundet: number; afgjort: number } | null {
  const afgjorte = boeder.filter((b) => b.afgoerelse === 'modtager_vandt' || b.afgoerelse === 'giver_vandt');
  const afgjort = tael(afgjorte, (b) => b.modtagerId);
  const vundet = tael(afgjorte, (b) => (b.afgoerelse === 'modtager_vandt' ? b.modtagerId : null));
  let bedst: { medlemId: string; vundet: number; afgjort: number } | null = null;
  for (const [id, v] of vundet) {
    const a = afgjort.get(id) ?? v;
    if (!bedst || v / a > bedst.vundet / bedst.afgjort || (v / a === bedst.vundet / bedst.afgjort && v > bedst.vundet)) {
      bedst = { medlemId: id, vundet: v, afgjort: a };
    }
  }
  return bedst;
}
