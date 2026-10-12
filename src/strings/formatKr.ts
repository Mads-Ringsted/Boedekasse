/**
 * Formats a whole-krone amount the Danish way: `1.250 kr`.
 * Done by hand so the result never depends on the phone's Intl data.
 */
export function formatKr(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  const digits = String(Math.abs(Math.round(amount)));
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}${grouped} kr`;
}
