import { da, type Catalogue } from './da.ts';

export type StringId = keyof Catalogue;

type Placeholders<S extends string> = S extends `${string}{${infer Name}}${infer Rest}`
  ? Name | Placeholders<Rest>
  : never;

/** Ids of strings with no placeholders; use it to pass an id around as a prop. */
export type PlainStringId = {
  [Id in StringId]: [Placeholders<Catalogue[Id]>] extends [never] ? Id : never;
}[StringId];

/** The values a string needs, or nothing when it has no placeholders. */
type Args<Id extends StringId, V> = [Placeholders<Catalogue[Id]>] extends [never]
  ? []
  : [values: Record<Placeholders<Catalogue[Id]>, V>];

const placeholder = /\{(\w+)\}/g;

/**
 * Splits a catalogue string into text and filled-in values. Values keep
 * their type, so a React element can be slotted in (see `<T>`).
 */
export function tParts<Id extends StringId, V>(id: Id, ...args: Args<Id, V>): Array<string | V> {
  const values = (args[0] ?? {}) as Record<string, V>;
  const parts: Array<string | V> = [];
  let last = 0;
  for (const match of da[id].matchAll(placeholder)) {
    const name = match[1];
    if (match.index > last) parts.push(da[id].slice(last, match.index));
    parts.push(name in values ? values[name] : match[0]);
    last = match.index + match[0].length;
  }
  if (last < da[id].length) parts.push(da[id].slice(last));
  return parts;
}

/** Looks up a UI string by id and fills its `{placeholders}`. */
export function t<Id extends StringId>(id: Id, ...args: Args<Id, string | number>): string;
export function t(id: PlainStringId): string;
export function t(id: StringId, values?: Record<string, string | number>): string {
  return (tParts as (id: StringId, v?: Record<string, string | number>) => unknown[])(id, values).join('');
}
