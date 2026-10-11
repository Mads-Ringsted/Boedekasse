import { describe, expect, it } from 'vitest';
import { clearPendingLogin, loadPendingLogin, resendWaitSeconds, savePendingLogin } from './pending.ts';

function memoryStorage() {
  const items = new Map<string, string>();
  return {
    getItem: (k: string) => items.get(k) ?? null,
    setItem: (k: string, v: string) => void items.set(k, v),
    removeItem: (k: string) => void items.delete(k),
  };
}

describe('pending login (survives switching to Mail and back)', () => {
  it('starts on the email step when nothing is pending', () => {
    expect(loadPendingLogin(memoryStorage())).toBeNull();
  });

  it('remembers the email and when the code was sent', () => {
    const storage = memoryStorage();
    savePendingLogin(storage, { email: 'mads@example.com', sentAt: 1_000 });
    expect(loadPendingLogin(storage)).toEqual({ email: 'mads@example.com', sentAt: 1_000 });
  });

  it('forgets it after login or Tilbage', () => {
    const storage = memoryStorage();
    savePendingLogin(storage, { email: 'mads@example.com', sentAt: 1_000 });
    clearPendingLogin(storage);
    expect(loadPendingLogin(storage)).toBeNull();
  });

  it('treats garbage in storage as nothing pending', () => {
    const storage = memoryStorage();
    storage.setItem('boedekasse.ventendeLogin', '{not json');
    expect(loadPendingLogin(storage)).toBeNull();
    storage.setItem('boedekasse.ventendeLogin', JSON.stringify({ email: 42 }));
    expect(loadPendingLogin(storage)).toBeNull();
  });

  it('never crashes when storage is blocked', () => {
    const blocked = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => {
        throw new Error('SecurityError');
      },
    };
    expect(loadPendingLogin(blocked)).toBeNull();
    expect(() => savePendingLogin(blocked, { email: 'a@b.dk', sentAt: 0 })).not.toThrow();
    expect(() => clearPendingLogin(blocked)).not.toThrow();
  });
});

describe('resendWaitSeconds ("Send ny kode" waits a minute, like the server)', () => {
  const pending = { email: 'mads@example.com', sentAt: 10_000 };

  it('counts down the 60 seconds after a code was sent', () => {
    expect(resendWaitSeconds(pending, 10_000)).toBe(60);
    expect(resendWaitSeconds(pending, 10_000 + 15_400)).toBe(45);
  });

  it('allows a new code after a minute', () => {
    expect(resendWaitSeconds(pending, 10_000 + 60_000)).toBe(0);
    expect(resendWaitSeconds(pending, 10_000 + 600_000)).toBe(0);
  });
});
