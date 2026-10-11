import { describe, expect, it } from 'vitest';
import { destinationAfterLogin } from './destination.ts';

const fcOelhunde = 'box-fc';
const kontoret = 'box-kontor';

describe('destinationAfterLogin (Velkommen, a box, or Vælg Bødekasse)', () => {
  it('shows Velkommen to a person in no box', () => {
    expect(destinationAfterLogin([], null)).toEqual({ kind: 'velkommen' });
  });

  it('opens the only box straight away', () => {
    expect(destinationAfterLogin([fcOelhunde], null)).toEqual({ kind: 'bodekasse', bodekasseId: fcOelhunde });
  });

  it('reopens the last-used box', () => {
    expect(destinationAfterLogin([fcOelhunde, kontoret], kontoret)).toEqual({
      kind: 'bodekasse',
      bodekasseId: kontoret,
    });
  });

  it('asks which box when there are several and none was used on this device', () => {
    expect(destinationAfterLogin([fcOelhunde, kontoret], null)).toEqual({ kind: 'vaelg' });
  });

  it('ignores a last-used box the person is no longer in', () => {
    expect(destinationAfterLogin([fcOelhunde], kontoret)).toEqual({ kind: 'bodekasse', bodekasseId: fcOelhunde });
    expect(destinationAfterLogin([], kontoret)).toEqual({ kind: 'velkommen' });
  });
});
