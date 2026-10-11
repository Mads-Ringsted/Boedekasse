import { describe, expect, it } from 'vitest';
import { betalere, dagTekst, forudfyldtBeloeb, haevTjek, kassePoster, type HaevningRaekke, type IndbetalingRaekke } from './kassen.ts';

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

  describe('with Hævninger', () => {
    const haevning = (r: Partial<HaevningRaekke> & { id: string }): HaevningRaekke => ({
      saeson_id: 's2',
      beloeb: 300,
      formaal: 'Depositum til julefrokost',
      registreret_af: 'frederik',
      registreret: '2026-10-10T10:00:00Z',
      annulleret: null,
      annulleret_af: null,
      annulleret_note: null,
      ...r,
    });
    const haevninger = [
      haevning({ id: 'depositum' }),
      haevning({
        id: 'bowling',
        beloeb: 60,
        formaal: 'Bowling',
        saeson_id: 's1',
        registreret: '2026-03-02T10:00:00Z',
        annulleret: '2026-03-02T11:00:00Z',
        annulleret_af: 'frederik',
        annulleret_note: 'Forkert beløb',
      }),
    ];

    it('lists Indbetalinger and Hævninger together, newest first', () => {
      const poster = kassePoster(rows, { navne, senesteSaesonId: 's2', erAdmin: false }, haevninger);
      expect(poster.map((p) => p.id)).toEqual(['ny', 'depositum', 'fjernet', 'bowling', 'gammel']);
    });

    it('gives a Hævning its purpose, who took it out, and any annulment', () => {
      const poster = kassePoster([], { navne, senesteSaesonId: 's2', erAdmin: true }, haevninger);
      expect(poster).toEqual([
        {
          art: 'haevning',
          id: 'depositum',
          formaal: 'Depositum til julefrokost',
          beloeb: 300,
          registreretAf: 'Frederik',
          tid: '2026-10-10T10:00:00Z',
          annulleret: null,
          kanAnnulleres: true,
        },
        {
          art: 'haevning',
          id: 'bowling',
          formaal: 'Bowling',
          beloeb: 60,
          registreretAf: 'Frederik',
          tid: '2026-03-02T10:00:00Z',
          annulleret: { af: 'Frederik', tid: '2026-03-02T11:00:00Z', note: 'Forkert beløb' },
          kanAnnulleres: false,
        },
      ]);
    });

    it('lets only an Admin annul a Hævning from the latest Sæson', () => {
      const poster = kassePoster([], { navne, senesteSaesonId: 's2', erAdmin: false }, haevninger);
      expect(poster.every((p) => !p.kanAnnulleres)).toBe(true);
    });
  });
});

describe('haevTjek (the Hæv penge form)', () => {
  it('is ready with a whole amount up to Kassen and a purpose', () => {
    expect(haevTjek('300', 'Depositum', 570)).toEqual({ kr: 300, overKassen: false, klar: true });
    expect(haevTjek('570', 'Depositum', 570)).toEqual({ kr: 570, overKassen: false, klar: true });
  });

  it('is not ready over Kassen', () => {
    expect(haevTjek('571', 'Depositum', 570)).toEqual({ kr: 571, overKassen: true, klar: false });
  });

  it('needs a purpose that is more than spaces', () => {
    expect(haevTjek('300', '   ', 570).klar).toBe(false);
  });

  it('needs a whole amount over 0', () => {
    expect(haevTjek('', 'Øl', 570)).toEqual({ kr: null, overKassen: false, klar: false });
    expect(haevTjek('0', 'Øl', 570).klar).toBe(false);
    expect(haevTjek('12,5', 'Øl', 570).klar).toBe(false);
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
