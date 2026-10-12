import { Fragment, type ReactNode } from 'react';
import { tParts, type StringId } from '../strings/index.ts';

/**
 * Renders a catalogue string with React elements in its placeholders,
 * e.g. `<T id="installer.trin1" values={{ del: <strong>Del</strong> }} />`.
 * Use `t()` for plain text.
 */
export function T({ id, values }: { id: StringId; values?: Record<string, ReactNode> }) {
  const parts = (tParts as (id: StringId, values?: Record<string, ReactNode>) => ReactNode[])(
    id,
    values,
  );
  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={i}>{part}</Fragment>
      ))}
    </>
  );
}
