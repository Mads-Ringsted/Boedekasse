import { describe, expect, it } from 'vitest';
import {
  ankeKongen,
  barometer,
  digTal,
  dyresteAften,
  dyresteDagForEn,
  engel,
  favorit,
  flestPaaEnAften,
  forhold,
  hurtigstTilAtBetale,
  hvornaar,
  kassenOverTid,
  laengstUden,
  mellem,
  mestGivne,
  mineKategorier,
  modparter,
  nemesis,
  perUge,
  placer,
  rivaleri,
  skydeskive,
  stablet,
  stakKategorier,
  stoerst,
  topTre,
  vaabenhvile,
  type StatBoede,
  type StatMedlem,
} from './statistik.ts';
import { aften, lokal, mandag, ugeNr } from './tid.ts';

let n = 0;
/** A Bøde; `givet` is a Copenhagen local time in November (UTC+1). */
function b(giver: string, modtager: string, kat: string | null, givet: string, extra: Partial<StatBoede> = {}): StatBoede {
  n += 1;
  return {
    id: `b${n}`,
    giverId: giver,
    modtagerId: modtager,
    baererId: modtager,
    kategoriId: kat,
    pris: 20,
    givet: new Date(`${givet}+01:00`).toISOString(),
    anket: false,
    afgoerelse: null,
    ...extra,
  };
}

const m = (id: string, udmeldt = false): StatMedlem => ({ id, navn: id, udmeldt });
const medlemmer = [m('mig'), m('jonas'), m('emil'), m('kasper'), m('sebastian'), m('oliver'), m('gammel', true)];

const boeder: StatBoede[] = [
  b('jonas', 'mig', 'sent', '2026-11-06T23:10:00'),
  b('jonas', 'mig', 'sent', '2026-11-07T00:30:00'),
  b('jonas', 'mig', 'tlf', '2026-11-13T23:40:00', { pris: 50 }),
  b('kasper', 'mig', 'tlf', '2026-11-14T21:00:00'),
  b('mig', 'emil', 'tlf', '2026-11-06T22:00:00', { anket: true, afgoerelse: 'giver_vandt' }),
  b('mig', 'emil', 'tlf', '2026-11-13T23:20:00'),
  b('mig', 'emil', 'sent', '2026-11-14T23:05:00'),
  b('mig', 'jonas', null, '2026-11-02T12:00:00', { pris: 60 }),
  b('mig', 'kasper', 'dum', '2026-11-13T23:50:00'),
  b('emil', 'kasper', 'dum', '2026-11-14T23:30:00', { anket: true, afgoerelse: 'modtager_vandt', baererId: 'emil' }),
  b('kasper', 'emil', 'dum', '2026-11-15T01:00:00'),
  b('gammel', 'jonas', 'dum', '2026-11-03T10:00:00'),
];

describe('tid (Copenhagen calendar)', () => {
  it('reads the local date, hour and weekday', () => {
    expect(lokal('2026-11-06T22:10:00Z')).toEqual({ dato: '2026-11-06', time: 23, ugedag: 4 });
  });
  it('counts 00:30 as the evening before (days run 06–06)', () => {
    expect(aften(new Date('2026-11-07T00:30:00+01:00').toISOString())).toBe('2026-11-06');
    expect(aften(new Date('2026-11-07T07:00:00+01:00').toISOString())).toBe('2026-11-07');
  });
  it('finds the ISO week and its Monday', () => {
    expect(mandag('2026-11-08')).toBe('2026-11-02');
    expect(ugeNr('2026-11-02')).toBe(45);
    expect(ugeNr('2027-01-01')).toBe(53);
  });
});

describe('Dig', () => {
  it('counts Fået and Givet with kr', () => {
    expect(digTal(boeder, 'mig')).toEqual({ faaet: { antal: 4, kr: 110 }, givet: { antal: 5, kr: 140 } });
  });

  it('says how giving compares with getting', () => {
    expect(forhold(22, 14)).toEqual({ art: 'giverFlere', gange: 1.6 });
    expect(forhold(3, 6)).toEqual({ art: 'faarFlere', gange: 2 });
    expect(forhold(2, 2)).toEqual({ art: 'lige' });
    expect(forhold(0, 0)).toEqual({ art: 'ingen' });
    expect(forhold(3, 0)).toEqual({ art: 'kunGivet' });
  });

  const parter = modparter(boeder, medlemmer, 'mig');

  it('lists every active Medlem but you, most given first; Udmeldte only with Bøder between you', () => {
    expect(parter.map((p) => [p.medlemId, p.gav, p.fik])).toEqual([
      ['emil', 3, 0],
      ['jonas', 1, 3],
      ['kasper', 1, 1],
      ['oliver', 0, 0],
      ['sebastian', 0, 0],
    ]);
  });

  it('finds the Nemesis, Skydeskive, Engel and Våbenhvile', () => {
    expect(nemesis(parter)?.medlemId).toBe('jonas');
    expect(skydeskive(parter)?.medlemId).toBe('emil');
    expect(engel(parter, medlemmer)?.medlemId).toBe('emil');
    expect(vaabenhvile(parter, medlemmer)?.medlemId).toBe('oliver');
    expect(nemesis(modparter([], medlemmer, 'mig'))).toBeNull();
  });

  it("finds a giver's favourite Bødekategori for someone", () => {
    expect(favorit(boeder, 'jonas', 'mig')).toEqual({ kategoriId: 'sent', antal: 2 });
    expect(favorit(boeder, 'mig', 'jonas')).toEqual({ kategoriId: null, antal: 1 });
    expect(favorit(boeder, 'oliver', 'mig')).toBeNull();
  });

  it('gives the latest Bøde and the appealed count between two Medlemmer', () => {
    const r = mellem(boeder, 'mig', 'emil');
    expect(r.antal).toBe(3);
    expect(r.anket).toBe(1);
    expect(r.seneste).toBe(boeder[6].givet);
  });

  it('splits your Bøder per Bødekategori, given and got', () => {
    expect(mineKategorier(boeder, 'mig')).toEqual([
      { kategoriId: 'tlf', gav: 2, fik: 2 },
      { kategoriId: 'sent', gav: 1, fik: 2 },
      { kategoriId: null, gav: 1, fik: 0 },
      { kategoriId: 'dum', gav: 1, fik: 0 },
    ]);
  });
});

describe('Holdet', () => {
  it('ranks the Bødekategorier', () => {
    expect(mestGivne(boeder).slice(0, 2)).toEqual([
      { kategoriId: 'tlf', antal: 4 },
      { kategoriId: 'dum', antal: 4 },
    ]);
  });

  it('finds the most dangerous weekday and hour', () => {
    const h = hvornaar(boeder);
    expect(h.ugedage).toEqual([1, 1, 0, 0, 5, 4, 1]);
    expect(h.farligst).toEqual({ ugedag: 4, time: 23, antal: 4 });
    expect(stoerst(h.timer)).toBe(23);
    expect(stoerst([0, 0])).toBe(-1);
  });

  it('lists the top three givers and receivers', () => {
    const t = topTre(boeder);
    expect(t.givere[0]).toEqual({ medlemId: 'mig', antal: 5 });
    expect(t.modtagere[0]).toEqual({ medlemId: 'mig', antal: 4 });
    expect(t.givere).toHaveLength(3);
  });

  it('counts Bøder per week from the start of the Sæson to now, empty weeks too', () => {
    const uger = perUge(boeder, '2026-10-20T10:00:00Z', '2026-11-20T10:00:00Z');
    expect(uger.map((u) => [u.nr, u.antal])).toEqual([
      [43, 0],
      [44, 0],
      [45, 5],
      [46, 7],
      [47, 0],
    ]);
  });

  it('stacks one Bødekategori per week and Medlem, top 4 then Andre', () => {
    const many = [
      ...['a', 'b', 'c', 'd', 'e', 'f'].flatMap((id, i) =>
        Array.from({ length: 6 - i }, () => b('x', id, 'sent', '2026-11-18T20:00:00')),
      ),
      b('x', 'a', 'sent', '2026-11-04T20:00:00'),
      b('x', 'a', 'sent', '2026-08-01T20:00:00'), // too old
      b('x', 'a', 'tlf', '2026-11-18T20:00:00'),
    ];
    const s = stablet(many, 'sent', '2026-11-20T10:00:00Z');
    expect(s.personer).toEqual(['a', 'b', 'c', 'd']);
    expect(s.medAndre).toBe(true);
    expect(s.uger).toHaveLength(8);
    const sidste = s.uger[7];
    expect(sidste.total).toBe(21);
    expect(sidste.stakke).toEqual([
      { medlemId: 'a', antal: 6 },
      { medlemId: 'b', antal: 5 },
      { medlemId: 'c', antal: 4 },
      { medlemId: 'd', antal: 3 },
      { medlemId: null, antal: 3 },
    ]);
    expect(s.uger[5].total).toBe(1);
    expect(s.top).toEqual({ medlemId: 'a', antal: 7 });
    expect(stakKategorier(many, '2026-11-20T10:00:00Z')).toEqual(['sent', 'tlf']);
  });

  it('finds the rivalry with the most back-and-forth', () => {
    expect(rivaleri(boeder)).toEqual({ a: 'jonas', b: 'mig', aTilB: 3, bTilA: 1 });
    expect(rivaleri([b('a', 'b', null, '2026-11-01T10:00:00')])).toBeNull();
  });
});

describe('Barometer', () => {
  it('ranks by count, first to reach it wins a tie, clowns only for 1–3 with at least one', () => {
    const r = barometer(boeder, 'dum', medlemmer);
    expect(r.map((p) => [p.medlemId, p.antal, p.klovn])).toEqual([
      ['kasper', 2, 1],
      ['jonas', 1, 2],
      ['emil', 1, 3],
      ['mig', 0, 0],
      ['oliver', 0, 0],
      ['sebastian', 0, 0],
    ]);
  });

  it('places rows by count without overlap, inside the column', () => {
    expect(placer([10, 5, 0], [70, 50, 40], 300)).toEqual([0, 125, 260]);
    expect(placer([10, 10, 9], [70, 50, 40], 300)).toEqual([0, 70, 120]);
    expect(placer([1, 1, 1, 1], [100, 100, 100, 100], 300)).toEqual([0, 0, 100, 200]);
  });
});

describe('Rekorder', () => {
  it('adds up the box per day', () => {
    const k = kassenOverTid([
      { medlemId: 'a', beloeb: 20, tid: '2026-11-02T10:00:00Z' },
      { medlemId: 'a', beloeb: 30, tid: '2026-11-01T10:00:00Z' },
      { medlemId: 'b', beloeb: 10, tid: '2026-11-02T12:00:00Z' },
    ]);
    expect(k.map((p) => p.ialt)).toEqual([30, 60]);
  });

  it('finds the dearest evening and the dearest day for one person', () => {
    expect(dyresteAften(boeder)).toEqual({ aften: '2026-11-13', kr: 90, antal: 3 });
    expect(dyresteDagForEn(boeder)).toEqual({ medlemId: 'emil', aften: '2026-11-14', kr: 60, antal: 3 });
  });

  it('finds most Bøder for one Medlem in one evening', () => {
    expect(flestPaaEnAften(boeder)).toEqual({ medlemId: 'mig', aften: '2026-11-06', antal: 2 });
  });

  it('finds the longest stretch without a Bøde, and whether it still runs', () => {
    const start = '2026-11-01T00:00:00Z';
    expect(laengstUden(boeder, medlemmer, start, '2026-11-21T00:00:00Z', true)).toEqual({
      medlemId: 'sebastian',
      dage: 20,
      iGang: true,
    });
    expect(laengstUden([b('x', 'a', null, '2026-11-11T01:00:00')], [m('a')], start, '2026-11-12T00:00:00Z', false)).toEqual({
      medlemId: 'a',
      dage: 10,
      iGang: false,
    });
  });

  it('works out who pays fastest, oldest charges first, weighted by kr', () => {
    const r = hurtigstTilAtBetale(
      [
        { medlemId: 'a', beloeb: 100, tid: '2026-11-01T00:00:00Z' },
        { medlemId: 'a', beloeb: 100, tid: '2026-11-05T00:00:00Z' },
        { medlemId: 'b', beloeb: 50, tid: '2026-11-01T00:00:00Z' },
      ],
      [
        { medlemId: 'a', beloeb: 200, tid: '2026-11-07T00:00:00Z' },
        { medlemId: 'b', beloeb: 50, tid: '2026-11-04T00:00:00Z' },
        { medlemId: 'c', beloeb: 50, tid: '2026-11-04T00:00:00Z' },
      ],
    );
    // a: (100×6 + 100×2) / 200 = 4 days; b: 3 days; c has nothing covered.
    expect(r).toEqual({ medlemId: 'b', dage: 3 });
  });

  it('crowns the Anke-konge', () => {
    expect(ankeKongen(boeder)).toEqual({ medlemId: 'kasper', vundet: 1, afgjort: 1 });
    expect(ankeKongen([])).toBeNull();
  });
});
