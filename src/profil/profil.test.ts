import { describe, expect, it } from 'vitest';
import { profilVisning, type Profil } from './profil.ts';

const jonas: Profil = {
  id: 'jonas',
  navn: 'Jonas Holm',
  erAdmin: false,
  loggetInd: true,
  udmeldt: false,
  saldo: 120,
  boederOgGebyrer: 200,
  betalt: 80,
  overfoert: 0,
};

describe('profilVisning (what a Medlem profile shows)', () => {
  it("shows someone else's debt as Mangler at betale, with Giv bøde and no Betal", () => {
    const v = profilVisning(jonas, 'mads');
    expect(v.egen).toBe(false);
    expect(v.status).toEqual({ art: 'mangler', beloeb: 120, kanBetale: true });
    expect(v.kanGiveBoede).toBe(true);
    expect(v.kanBetale).toBe(false);
  });

  it('gives your own profile Betal while you owe, and no Giv bøde (you cannot fine yourself)', () => {
    const v = profilVisning(jonas, 'jonas');
    expect(v.egen).toBe(true);
    expect(v.kanBetale).toBe(true);
    expect(v.kanGiveBoede).toBe(false);
  });

  it('shows Til gode on your own profile when you paid too much, with no Betal', () => {
    const v = profilVisning({ ...jonas, saldo: -30 }, 'jonas');
    expect(v.status).toEqual({ art: 'tilGode', beloeb: 30, kanBetale: false });
    expect(v.kanBetale).toBe(false);
  });

  it('tags an Admin and a Medlem who has not logged in yet', () => {
    expect(profilVisning(jonas, 'mads').tags).toEqual([]);
    expect(profilVisning({ ...jonas, erAdmin: true }, 'mads').tags).toEqual(['admin']);
    expect(profilVisning({ ...jonas, erAdmin: true, loggetInd: false }, 'mads').tags).toEqual([
      'admin',
      'ikkeLoggetInd',
    ]);
  });

  it('tags an Udmeldt and offers no Giv bøde (they are out of Giv bøder)', () => {
    const v = profilVisning({ ...jonas, udmeldt: true }, 'mads');
    expect(v.tags).toEqual(['udmeldt']);
    expect(v.kanGiveBoede).toBe(false);
  });

  it('hides Betal on your own profile at Saldo 0', () => {
    expect(profilVisning({ ...jonas, saldo: 0 }, 'jonas').kanBetale).toBe(false);
  });

  it('shows what was carried over from last Sæson, and nothing when it was 0', () => {
    expect(profilVisning(jonas, 'mads').overfoert).toBeNull();
    expect(profilVisning({ ...jonas, overfoert: 150 }, 'mads').overfoert).toBe('150 kr');
    expect(profilVisning({ ...jonas, overfoert: 1250 }, 'jonas').overfoert).toBe('1.250 kr');
  });

  it('shows Til gode carried over from last Sæson as "til gode"', () => {
    expect(profilVisning({ ...jonas, overfoert: -30 }, 'mads').overfoert).toBe('30 kr til gode');
  });
});
