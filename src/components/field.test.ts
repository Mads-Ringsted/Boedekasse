import { describe, expect, it } from 'vitest';
import { fieldKeyboard, primaryAction, typedRequirement, visibleError, type Requirement } from './field.ts';

describe('fieldKeyboard (which keyboard a field opens)', () => {
  it('opens the number pad for whole kroner', () => {
    expect(fieldKeyboard('integer')).toMatchObject({ type: 'text', inputMode: 'numeric', enterKeyHint: 'done' });
  });

  it('opens the decimal pad for values like "1,5" and the Placeringer list', () => {
    expect(fieldKeyboard('decimal')).toMatchObject({ type: 'text', inputMode: 'decimal' });
  });

  it('opens the email keyboard without capitals or autocorrect', () => {
    expect(fieldKeyboard('email')).toEqual({
      type: 'email',
      inputMode: 'email',
      enterKeyHint: 'done',
      autoCapitalize: 'none',
      autoCorrect: 'off',
      spellCheck: false,
    });
  });

  it('capitalises each word of a name', () => {
    expect(fieldKeyboard('name')).toMatchObject({ type: 'text', inputMode: 'text', autoCapitalize: 'words' });
  });

  it('shows "Søg" on the enter key of a search field', () => {
    expect(fieldKeyboard('search')).toMatchObject({ type: 'search', inputMode: 'search', enterKeyHint: 'search' });
  });

  it('uses the date picker for a date', () => {
    expect(fieldKeyboard('date')).toMatchObject({ type: 'date' });
  });

  it('opens the plain keyboard for text, with sentence capitals', () => {
    expect(fieldKeyboard('text')).toMatchObject({
      type: 'text',
      inputMode: 'text',
      enterKeyHint: 'done',
      autoCapitalize: 'sentences',
    });
  });
});

describe('visibleError (when a field shows what is wrong)', () => {
  it('says nothing while the field is empty, so a new form does not start in red', () => {
    expect(visibleError('', 'Skriv et helt antal kroner.')).toBeNull();
    expect(visibleError('   ', 'Skriv et helt antal kroner.')).toBeNull();
  });

  it('shows the error once something is typed', () => {
    expect(visibleError('12,5', 'Skriv et helt antal kroner.')).toBe('Skriv et helt antal kroner.');
  });

  it('shows nothing when the value is fine', () => {
    expect(visibleError('120', null)).toBeNull();
    expect(visibleError('120', undefined)).toBeNull();
  });
});

describe('typedRequirement (a typed value the action needs)', () => {
  it('asks for the value while the field is empty', () => {
    expect(typedRequirement('  ', false, 'Skriv et beløb.', 'Ret beløbet.')).toEqual([false, 'Skriv et beløb.']);
  });

  it('asks to fix it when what is typed is not valid', () => {
    expect(typedRequirement('12,5', false, 'Skriv et beløb.', 'Ret beløbet.')).toEqual([false, 'Ret beløbet.']);
  });

  it('is met when the value is valid', () => {
    expect(typedRequirement('120', true, 'Skriv et beløb.', 'Ret beløbet.')[0]).toBe(true);
  });
});

describe('primaryAction (whether Gem is on, and why not)', () => {
  const navn: Requirement = [false, 'Skriv et navn.'];
  const beloeb: Requirement = [false, 'Skriv et beløb.'];

  it('is on when every requirement is met', () => {
    expect(primaryAction([[true, 'Skriv et navn.'], [true, 'Skriv et beløb.']])).toEqual({
      enabled: true,
      reason: null,
    });
  });

  it('is off with the first unmet requirement as the reason', () => {
    expect(primaryAction([[true, 'Skriv et navn.'], beloeb, [false, 'Vælg mindst ét medlem.']])).toEqual({
      enabled: false,
      reason: 'Skriv et beløb.',
    });
    expect(primaryAction([navn, beloeb]).reason).toBe('Skriv et navn.');
  });

  it('is off without a reason while it saves', () => {
    expect(primaryAction([[true, 'Skriv et navn.']], { busy: true })).toEqual({ enabled: false, reason: null });
    expect(primaryAction([navn], { busy: true })).toEqual({ enabled: false, reason: null });
  });

  it('is off without a reason while nothing has changed, since there is nothing to save', () => {
    expect(primaryAction([[true, 'Skriv et navn.']], { unchanged: true })).toEqual({ enabled: false, reason: null });
  });

  it('still says what is missing when the starting value is itself not valid', () => {
    expect(primaryAction([navn], { unchanged: true })).toEqual({ enabled: false, reason: 'Skriv et navn.' });
  });
});
