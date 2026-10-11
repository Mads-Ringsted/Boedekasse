const KEY = 'boedekasse.sidstBrugt';

/** The box this device opened last; the app reopens it after a launch. */
export function loadLastUsed(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function saveLastUsed(bodekasseId: string): void {
  try {
    localStorage.setItem(KEY, bodekasseId);
  } catch {
    // Only means the next launch may ask which box.
  }
}
