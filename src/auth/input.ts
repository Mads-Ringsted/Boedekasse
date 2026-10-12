export const CODE_LENGTH = 6;

/** Digits only, at most six: copes with typing, paste and iOS autofill. */
export function cleanCode(input: string): string {
  return input.replace(/\D/g, '').slice(0, CODE_LENGTH);
}

export function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}

/** A light check before "Send kode"; the server has the final say. */
export function looksLikeEmail(input: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(input));
}
