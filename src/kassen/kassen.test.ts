import { describe, expect, it } from 'vitest';
import { betalere, dagTekst, forudfyldtBeloeb, kassePoster, type IndbetalingRaekke } from './kassen.ts';

describe('betalere (who an Admin can register an Indbetaling from)', () => {
  const medlemmer = [
    { id: 'o', navn: 'Øjvind', udmeldt: null },
    { id: 'u', navn: 'Udo', udmeldt: '2026-09-01T10:00:00Z' },
    { id: 'a', navn: 'Anna', udmeldt: null },
    { id: 'm', navn: 'Mads', udmeldt: null },
  ];
  const saldi = [
    { medlem_id: 'a', saldo: 120 },
    { medlem_id: 'u', saldo: 30 },
    { medlem_id: 'm', saldo: -20 },
  ];

  it('lists everyone incl. Udmeldte, in Danish name order, each with their Saldo', () => {
    const { aktive, udmeldte } = betalere(medlemmer, saldi);
    expect(aktive.map((b) => [b.navn, b.saldo])).toEqual([
      ['Anna', 120],
      ['Mads', -20],
      ['Øjvind', 0],
    ]);
    expect(udmeldte.map((b) => [b.navn, b.saldo])).toEqual([['Udo', 30]]);
  });
});

describe('forudfyldtBeloeb (the amount Registrér indbetaling starts with)', () => {
  it('is what the Medlem owes, or empty when they owe nothing', () => {
    expect(forudfyldtBeloeb(120)).toBe('120');
    expect(forudfyldtBeloeb(0)).toBe('');
    expect(forudfyldtBeloeb(-20)).toBe('');
  });
});

describe('kassePoster (the list of Indbetalinger on Kassen)', () => {
  const navne = new Map([
    ['frederik', 'Frederik'],
    ['kasper', 'Kasper'],
    ['lucas', 'Lucas'],
  ]);
  const raekke = (r: Partial<IndbetalingRaekke> & { id: string }): IndbetalingRaekke => ({
    saeson_id: 's2',
    medlem_id: 'kasper',
    beloeb: 80,
    note: null,
    registreret_af: 'frederik',
    registreret: '2026-10-11T10:00:00Z',
    annulleret: null,
    annulleret_af: null,
    annulleret_note: null,
    ...r,
  });
  const rows = [
    raekke({ id: 'gammel', saeson_id: 's1', registreret: '2026-03-01T10:00:00Z' }),
    raekke({
      id: 'fjernet',
      medlem_id: 'lucas',
      beloeb: 50,
      registreret: '2026-10-08T10:00:00Z',
      annulleret: '2026-10-08T11:00:00Z',
      annulleret_af: 'frederik',
      annulleret_note: 'Forkert person',
    }),
    raekke({ id: 'ny', note: 'Kontant' }),
  ];

  it('lists newest first with who paid, who registered it and the note', () => {
    const poster = kassePoster(rows, { navne, senesteSaesonId: 's2', erAdmin: false });
    expect(poster.map((p) => p.id)).toEqual(['ny', 'fjernet', 'gammel']);
    expect(poster[0]).toMatchObject({ navn: 'Kasper', beloeb: 80, registreretAf: 'Frederik', note: 'Kontant' });
  });

  it('marks an annulled one with who did it and the note', () => {
    const [, fjernet] = kassePoster(rows, { navne, senesteSaesonId: 's2', erAdmin: true });
    expect(fjernet?.annulleret).toEqual({ af: 'Frederik', tid: '2026-10-08T11:00:00Z', note: 'Forkert person' });
  });

  it('lets only an Admin annul, only in the latest Sæson, and only once', () => {
    const kan = (erAdmin: boolean) =>
      kassePoster(rows, { navne, senesteSaesonId: 's2', erAdmin }).map((p) => [p.id, p.kanAnnulleres]);
    expect(kan(true)).toEqual([
      ['ny', true],
      ['fjernet', false],
      ['gammel', false],
    ]);
    expect(kan(false).every(([, k]) => k === false)).toBe(true);
  });
});

describe('dagTekst (when an Indbetaling happened, on Kassen)', () => {
  const nu = new Date('2026-10-11T10:00:00+02:00');

  it('says "i dag" and "i går" by the Danish calendar day', () => {
    expect(dagTekst('2026-10-11T00:30:00+02:00', nu)).toBe('i dag');
    expect(dagTekst('2026-10-10T23:30:00+02:00', nu)).toBe('i går');
  });

  it('gives a short date further back', () => {
    expect(dagTekst('2026-10-08T12:00:00+02:00', nu)).toBe('8. okt');
    expect(dagTekst('2025-12-24T12:00:00+01:00', nu)).toBe('24. dec 2025');
  });
});
