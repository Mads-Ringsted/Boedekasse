import { describe, expect, it } from 'vitest';
import { adminHandlinger, type AdminMedlem } from './adminHandlinger.ts';

const sebastian: AdminMedlem = { erAdmin: false, erKasserer: false, loggetInd: false, udmeldt: false, email: 'sebastian@eksempel.dk' };
const arter = (h: { art: string }[]) => h.map((x) => x.art);

describe('adminHandlinger (the rows in "Handlinger for X")', () => {
  it('shows the mock order for a Medlem who has not logged in', () => {
    const { hoved, farlig } = adminHandlinger(sebastian, { egen: false, sletGrund: 'boeder' });
    expect(arter(hoved)).toEqual(['registrerIndbetaling', 'goerTilAdmin', 'goerTilKasserer', 'retNavn', 'retEmail']);
    expect(hoved[4]).toEqual({ art: 'retEmail', email: 'sebastian@eksempel.dk' });
    expect(farlig).toEqual([{ art: 'meldUd' }, { art: 'slet', grund: 'boeder' }]);
  });

  it('offers Fjern som Admin for an Admin, and no Ret email once logged in', () => {
    const { hoved } = adminHandlinger(
      { ...sebastian, erAdmin: true, loggetInd: true },
      { egen: false, sletGrund: 'logget_ind' },
    );
    expect(arter(hoved)).toEqual(['registrerIndbetaling', 'fjernSomAdmin', 'goerTilKasserer', 'retNavn']);
  });

  it('offers Genoptag instead of Meld ud, and no role change, for an Udmeldt', () => {
    const { hoved, farlig } = adminHandlinger({ ...sebastian, udmeldt: true }, { egen: false, sletGrund: 'historik' });
    expect(arter(hoved)).toEqual(['registrerIndbetaling', 'retNavn', 'retEmail']);
    expect(farlig).toEqual([{ art: 'genoptag' }, { art: 'slet', grund: 'historik' }]);
  });

  it('offers Registrér frikøb after Registrér indbetaling while Frikøb can be bought', () => {
    const { hoved } = adminHandlinger(sebastian, { egen: false, sletGrund: 'boeder', frikob: true });
    expect(arter(hoved)).toEqual([
      'registrerIndbetaling',
      'registrerFrikob',
      'goerTilAdmin',
      'goerTilKasserer',
      'retNavn',
      'retEmail',
    ]);
    expect(
      arter(adminHandlinger({ ...sebastian, udmeldt: true }, { egen: false, sletGrund: null, frikob: true }).hoved),
    ).not.toContain('registrerFrikob');
    expect(
      arter(adminHandlinger({ ...sebastian, erAdmin: true }, { egen: true, sletGrund: null, frikob: true }).hoved),
    ).not.toContain('registrerFrikob');
  });

  it('lets Slet go ahead when nothing stops it', () => {
    const { farlig } = adminHandlinger(sebastian, { egen: false, sletGrund: null });
    expect(farlig[1]).toEqual({ art: 'slet', grund: null });
  });

  it('offers Fjern som Kasserer for a Kasserer', () => {
    const { hoved } = adminHandlinger(
      { ...sebastian, erKasserer: true, loggetInd: true },
      { egen: false, sletGrund: 'logget_ind' },
    );
    expect(arter(hoved)).toEqual(['registrerIndbetaling', 'goerTilAdmin', 'fjernSomKasserer', 'retNavn']);
  });

  it('on your own profile: only Registrér indbetaling and your roles', () => {
    const { hoved, farlig } = adminHandlinger(
      { ...sebastian, erAdmin: true, loggetInd: true },
      { egen: true, sletGrund: 'logget_ind' },
    );
    expect(arter(hoved)).toEqual(['registrerIndbetaling', 'fjernSomAdmin', 'goerTilKasserer']);
    expect(farlig).toEqual([]);
  });
});
