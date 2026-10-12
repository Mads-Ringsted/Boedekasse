import { describe, expect, it } from 'vitest';
import { komIGang } from './komIGang.ts';

describe('komIGang (the "Kom i gang" checklist on a new Hjem)', () => {
  it('in a brand-new box: the box is made, inviting is next, the rest comes later', () => {
    expect(komIGang({ antalMedlemmer: 1, antalBodekategorier: 0, antalBoeder: 0 })).toEqual([
      { trin: 'opret', status: 'gjort' },
      { trin: 'inviter', status: 'naeste' },
      { trin: 'kategorier', status: 'senere' },
      { trin: 'boede', status: 'senere' },
    ]);
  });

  it('ticks off inviting once someone else is in the box', () => {
    expect(komIGang({ antalMedlemmer: 3, antalBodekategorier: 0, antalBoeder: 0 })).toEqual([
      { trin: 'opret', status: 'gjort' },
      { trin: 'inviter', status: 'gjort' },
      { trin: 'kategorier', status: 'naeste' },
      { trin: 'boede', status: 'senere' },
    ]);
  });

  it('points at the first step not done, even when a later one is done', () => {
    expect(komIGang({ antalMedlemmer: 1, antalBodekategorier: 4, antalBoeder: 0 })).toEqual([
      { trin: 'opret', status: 'gjort' },
      { trin: 'inviter', status: 'naeste' },
      { trin: 'kategorier', status: 'gjort' },
      { trin: 'boede', status: 'senere' },
    ]);
  });

  it('goes away once the first Bøde is given', () => {
    expect(komIGang({ antalMedlemmer: 1, antalBodekategorier: 0, antalBoeder: 1 })).toBeNull();
  });
});
