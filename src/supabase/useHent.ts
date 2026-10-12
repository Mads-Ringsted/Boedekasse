import { useCallback, useEffect, useRef, useState } from 'react';

export type Hentet<T> = { status: 'loading' } | { status: 'error'; error: unknown } | { status: 'ready'; data: T };

/**
 * Runs an async read on mount and whenever `deps` change; `reload()` runs it
 * again. Keeps the last data while reloading, so the screen doesn't blink.
 * An answer that arrives after a newer request started is dropped.
 */
export function useHent<T>(hent: () => Promise<T>, deps: readonly unknown[]): Hentet<T> & { reload: () => void } {
  const [state, setState] = useState<Hentet<T>>({ status: 'loading' });
  const [runde, setRunde] = useState(0);
  const hentRef = useRef(hent);
  hentRef.current = hent;

  useEffect(() => {
    let aktuel = true;
    hentRef.current().then(
      (data) => aktuel && setState({ status: 'ready', data }),
      (error: unknown) => aktuel && setState({ status: 'error', error }),
    );
    return () => {
      aktuel = false;
    };
  }, [...deps, runde]); // the caller lists the deps that `hent` reads

  const reload = useCallback(() => setRunde((n) => n + 1), []);
  return { ...state, reload };
}
