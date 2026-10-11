import { describe, expect, it } from 'vitest';
import { medlemsliste, type MedlemRaekke } from './medlemsliste.ts';

const medlem = (id: string, navn: string, extra: Partial<MedlemRaekke> = {}): MedlemRaekke => ({
  id,
  navn,
  er_admin: false,
  user_id: `bruger-${id}`,
  udmeldt: null,
  ...extra,
});

describe('medlemsliste (the rows on Medlemmer)', () => {
  it('lists active Medlemmer by name in Danish order, with what each owes', () => {
    const rows = medlemsliste(
      [medlem('a', 'Åse'), medlem('z', 'Zenia'), medlem('e', 'Emil Bach'), medlem('o', 'Øjvind')],
      [
        { medlem_id: 'e', saldo: 85 },
        { medlem_id: 'z', saldo: 0 },
        { medlem_id: 'o', saldo: -20 },
        { medlem_id: 'a', saldo: 40 },
      ],
      'e',
    );
    expect(rows.map((r) => [r.navn, r.saldo])).toEqual([
      ['Emil Bach', 85],
      ['Zenia', 0],
      ['Øjvind', -20],
      ['Åse', 40],
    ]);
  });

  it('marks your own row, Admins and who has not logged in yet', () => {
    const [mig, sebastian] = medlemsliste(
      [medlem('m', 'Mads', { er_admin: true }), medlem('s', 'Sebastian', { user_id: null })],
      [],
      'm',
    );
    expect(mig).toMatchObject({ egen: true, erAdmin: true, loggetInd: true });
    expect(sebastian).toMatchObject({ egen: false, erAdmin: false, loggetInd: false });
  });

  it('leaves out Udmeldte and counts a Medlem with no Saldo row as owing 0 kr', () => {
    const rows = medlemsliste(
      [medlem('a', 'Anders Vang', { udmeldt: '2026-09-01T10:00:00Z' }), medlem('p', 'Peter Skov')],
      [{ medlem_id: 'a', saldo: 40 }],
      'x',
    );
    expect(rows).toEqual([
      { id: 'p', navn: 'Peter Skov', erAdmin: false, loggetInd: true, egen: false, saldo: 0 },
    ]);
  });
});
