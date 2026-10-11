import { describe, expect, it } from 'vitest';
import { handlinger, konkurrenceDato } from './konkurrence.ts';
import {
  fraResultat,
  gebyrForPlads,
  opsummer,
  parsePlaceringer,
  pladser,
  skiftDelt,
  tilGrupper,
  tryk,
  TOM,
} from './raekkefoelge.ts';

const TABEL = [0, 10, 25, 35, 40, 45, 50];

describe('the finishing order', () => {
  it('places Medlemmer in the order they are tapped', () => {
    const r = tryk(tryk(tryk(TOM, 'frederik'), 'kasper'), 'jonas');
    expect(pladser(r)).toEqual([
      { medlemId: 'frederik', plads: 1 },
      { medlemId: 'kasper', plads: 2 },
      { medlemId: 'jonas', plads: 3 },
    ]);
  });

  it('lets a tie share a place and skip the next (1, 2, 2, 4)', () => {
    let r = ['a', 'b', 'c', 'd'].reduce(tryk, TOM);
    r = skiftDelt(r, 'c');
    expect(pladser(r).map((p) => p.plads)).toEqual([1, 2, 2, 4]);
    expect(tilGrupper(r)).toEqual([['a'], ['b', 'c'], ['d']]);
  });

  it('undoes a tie when toggled again', () => {
    const r = skiftDelt(skiftDelt(['a', 'b'].reduce(tryk, TOM), 'b'), 'b');
    expect(pladser(r).map((p) => p.plads)).toEqual([1, 2]);
  });

  it('cannot tie the first place with nobody', () => {
    const r = skiftDelt(['a', 'b'].reduce(tryk, TOM), 'a');
    expect(pladser(r).map((p) => p.plads)).toEqual([1, 2]);
  });

  it('removes a Medlem tapped again, and the rest move up', () => {
    const r = tryk(['a', 'b', 'c'].reduce(tryk, TOM), 'a');
    expect(pladser(r)).toEqual([
      { medlemId: 'b', plads: 1 },
      { medlemId: 'c', plads: 2 },
    ]);
  });

  it('starts a correction from the saved result, ties included', () => {
    const r = fraResultat([
      { medlemId: 'd', plads: 4 },
      { medlemId: 'x', plads: null },
      { medlemId: 'a', plads: 1 },
      { medlemId: 'b', plads: 2 },
      { medlemId: 'c', plads: 2 },
    ]);
    expect(tilGrupper(r)).toEqual([['a'], ['b', 'c'], ['d']]);
  });
});

describe('Gebyrer', () => {
  it('takes a place\'s Gebyr from the table; places past its end pay the last amount', () => {
    expect(gebyrForPlads(1, TABEL)).toBe(0);
    expect(gebyrForPlads(3, TABEL)).toBe(25);
    expect(gebyrForPlads(7, TABEL)).toBe(50);
    expect(gebyrForPlads(12, TABEL)).toBe(50);
  });

  it('sums the footer: placed, absent and the total', () => {
    const r = ['frederik', 'kasper', 'jonas'].reduce(tryk, TOM);
    const alle = ['frederik', 'kasper', 'jonas', 'emil', 'mads', 'lucas', 'oliver', 'sebastian'];
    expect(opsummer(r, alle, TABEL, 50)).toEqual({ placeret: 3, fravaerende: 5, total: 285 });
  });
});

describe('who may correct or annul', () => {
  const k = { oprettetAf: 'frederik', saesonId: 's1', annullering: null };
  const koerer = { aktivSaesonId: 's1', senesteSaesonId: 's1' };
  const pause = { aktivSaesonId: null, senesteSaesonId: 's1' };

  it('lets the recorder and Admins correct and annul in the running Sæson', () => {
    expect(handlinger(k, { medlemId: 'frederik', erAdmin: false }, koerer)).toEqual({ ret: true, annuller: true });
    expect(handlinger(k, { medlemId: 'mads', erAdmin: true }, koerer)).toEqual({ ret: true, annuller: true });
    expect(handlinger(k, { medlemId: 'jonas', erAdmin: false }, koerer)).toEqual({ ret: false, annuller: false });
  });

  it('only annuls in a Pause, and nothing in a past Sæson or once annulled', () => {
    const mig = { medlemId: 'frederik', erAdmin: false };
    expect(handlinger(k, mig, pause)).toEqual({ ret: false, annuller: true });
    expect(handlinger(k, mig, { aktivSaesonId: 's2', senesteSaesonId: 's2' })).toEqual({ ret: false, annuller: false });
    const annulleret = { ...k, annullering: { tid: 'x', afId: 'mads', afNavn: 'Mads', note: null } };
    expect(handlinger(annulleret, mig, koerer)).toEqual({ ret: false, annuller: false });
  });
});

describe('dates', () => {
  it('shows a Konkurrence date in Danish, short within this year', () => {
    const nu = new Date('2026-10-11T12:00:00Z');
    expect(konkurrenceDato('2026-10-10', false, nu)).toBe('10. okt 2026');
    expect(konkurrenceDato('2026-10-10', true, nu)).toBe('10. okt');
    expect(konkurrenceDato('2025-08-22', true, nu)).toBe('22. aug 2025');
  });
});

describe('the placement table setting', () => {
  it('reads whole kroner separated by commas, slashes or spaces', () => {
    expect(parsePlaceringer('0, 10, 25 / 35 40')).toEqual([0, 10, 25, 35, 40]);
  });

  it('rejects an empty table, negatives, decimals and words', () => {
    expect(parsePlaceringer('')).toBeNull();
    expect(parsePlaceringer('0, -5')).toBeNull();
    expect(parsePlaceringer('0, 10,5')).toEqual([0, 10, 5]);
    expect(parsePlaceringer('0, 10.5')).toBeNull();
    expect(parsePlaceringer('nul')).toBeNull();
  });
});
