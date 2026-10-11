import type { ReactNode } from 'react';
import './Screen.css';

/**
 * A tab or pushed screen: respects the safe areas and leaves room for the
 * tab bar. Pass `title` for a large screen title.
 */
export function Screen({ title, children }: { title?: string; children?: ReactNode }) {
  return (
    <main className="screen">
      {title && <h1 className="screen__title">{title}</h1>}
      {children}
    </main>
  );
}
