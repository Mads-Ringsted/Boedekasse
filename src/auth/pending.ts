/**
 * The login in progress: which email got a code, and when. Saved on the
 * device so that iOS killing the app while the person is in Mail still
 * brings them back to code entry.
 */
export interface PendingLogin {
  email: string;
  /** `Date.now()` when the last code was sent. */
  sentAt: number;
}

export type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const KEY = 'boedekasse.ventendeLogin';
const RESEND_AFTER_MS = 60_000; // Supabase allows one code per email per minute

export function loadPendingLogin(storage: KeyValueStorage): PendingLogin | null {
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (
      typeof value === 'object' &&
      value !== null &&
      'email' in value &&
      typeof value.email === 'string' &&
      'sentAt' in value &&
      typeof value.sentAt === 'number'
    ) {
      return { email: value.email, sentAt: value.sentAt };
    }
    return null;
  } catch {
    return null;
  }
}

export function savePendingLogin(storage: KeyValueStorage, pending: PendingLogin): void {
  try {
    storage.setItem(KEY, JSON.stringify(pending));
  } catch {
    // Blocked storage only means a relaunch starts over at the email step.
  }
}

export function clearPendingLogin(storage: KeyValueStorage): void {
  try {
    storage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}

/** Whole seconds until "Send ny kode" may be used again; 0 = now. */
export function resendWaitSeconds(pending: PendingLogin, now: number): number {
  return Math.max(0, Math.ceil((pending.sentAt + RESEND_AFTER_MS - now) / 1000));
}
