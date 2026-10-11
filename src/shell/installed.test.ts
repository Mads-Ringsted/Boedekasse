import { describe, expect, it } from 'vitest';
import { isInstalled } from './installed.ts';

const safariTab = { displayModeStandalone: false, navigatorStandalone: false, dev: false, search: '' };

describe('isInstalled (app or install guide)', () => {
  it('shows the install guide in a Safari tab', () => {
    expect(isInstalled(safariTab)).toBe(false);
  });

  it('shows the app when opened from the home screen', () => {
    expect(isInstalled({ ...safariTab, displayModeStandalone: true })).toBe(true);
  });

  it("trusts iOS's navigator.standalone too", () => {
    expect(isInstalled({ ...safariTab, navigatorStandalone: true })).toBe(true);
  });

  it('shows the app in a desktop browser during local development', () => {
    expect(isInstalled({ ...safariTab, dev: true })).toBe(true);
  });

  it('shows the install guide during local development with ?installer', () => {
    expect(isInstalled({ ...safariTab, dev: true, search: '?installer' })).toBe(false);
  });
});
