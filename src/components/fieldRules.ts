/** What a field holds; it picks the keyboard (see `fieldKeyboard`). */
export type FieldKind = 'text' | 'name' | 'email' | 'integer' | 'decimal' | 'date' | 'search';

export type EnterKeyHint = 'done' | 'next' | 'search' | 'send' | 'go' | 'enter' | 'previous';

/** The input attributes that choose the software keyboard. */
export interface FieldKeyboard {
  type: 'text' | 'email' | 'date' | 'search';
  inputMode: 'text' | 'numeric' | 'decimal' | 'email' | 'search';
  enterKeyHint: EnterKeyHint;
  autoCapitalize: 'none' | 'sentences' | 'words';
  autoCorrect: 'on' | 'off';
  spellCheck: boolean;
}

const tekst: FieldKeyboard = {
  type: 'text',
  inputMode: 'text',
  enterKeyHint: 'done',
  autoCapitalize: 'sentences',
  autoCorrect: 'on',
  spellCheck: true,
};

const tal: FieldKeyboard = { ...tekst, autoCapitalize: 'none', autoCorrect: 'off', spellCheck: false };

const KEYBOARDS: Record<FieldKind, FieldKeyboard> = {
  text: tekst,
  name: { ...tekst, autoCapitalize: 'words' },
  email: { ...tal, type: 'email', inputMode: 'email' },
  // Whole kroner, days, hours: the number pad, which has no comma.
  integer: { ...tal, inputMode: 'numeric' },
  // "1,5" and "0, 10, 25": the decimal pad, which has a comma.
  decimal: { ...tal, inputMode: 'decimal' },
  date: { ...tal, type: 'date' },
  search: { ...tekst, type: 'search', inputMode: 'search', enterKeyHint: 'search', autoCapitalize: 'none' },
};

/** The keyboard for a kind of field: type, inputMode, enter key and autocorrect. */
export function fieldKeyboard(kind: FieldKind): FieldKeyboard {
  return KEYBOARDS[kind];
}

/**
 * A validation error to show under a field: only once something is typed,
 * so a new form does not open in red. Empty fields explain themselves
 * through the disabled reason (see `primaryAction`).
 */
export function visibleError(value: string, error: string | null | undefined): string | null {
  return value.trim() !== '' && error ? error : null;
}

/** One thing the primary action needs: met or not, and what to tell the user when not. */
export type Requirement = readonly [met: boolean, reason: string];

/** A typed value the action needs: `missing` while the field is empty, `wrong` while it is not valid. */
export function typedRequirement(value: string, valid: boolean, missing: string, wrong: string): Requirement {
  return [valid, value.trim() === '' ? missing : wrong];
}

export interface PrimaryActionState {
  enabled: boolean;
  /** Why it is off, for the sheet to show by the button. Null when on, saving or unchanged. */
  reason: string | null;
}

/**
 * Whether a sheet's primary action is on, and the reason when it is off: the
 * first unmet requirement, in the order of the form. Saving and "nothing
 * changed yet" turn it off without a reason; both explain themselves.
 */
export function primaryAction(
  requirements: readonly Requirement[],
  { busy = false, unchanged = false }: { busy?: boolean; unchanged?: boolean } = {},
): PrimaryActionState {
  if (busy) return { enabled: false, reason: null };
  const unmet = requirements.find(([met]) => !met);
  if (unmet) return { enabled: false, reason: unmet[1] };
  return { enabled: !unchanged, reason: null };
}
