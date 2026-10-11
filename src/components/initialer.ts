const first = (word: string) => Array.from(word)[0]?.toLocaleUpperCase('da') ?? '';

/** Avatar letters: first letter of the first and the last name ("MR"). */
export function initialer(navn: string): string {
  const words = navn.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  if (words.length === 1) return first(words[0]);
  return first(words[0]) + first(words[words.length - 1]);
}

/** The single letter on a Bødekasse tile ("F" for FC Ølhunde). */
export function forbogstav(navn: string): string {
  return first(navn.trim());
}
