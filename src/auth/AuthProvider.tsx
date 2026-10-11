import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { isAuthRetryableFetchError, type Session, type User } from '@supabase/supabase-js';
import { supabase } from '../supabase/index.ts';

/**
 * - `loading`: reading the saved session.
 * - `unreachable`: a saved session exists but could not be refreshed
 *   (no connection). We never treat that as logged out; we retry.
 * - `loggedOut` / `loggedIn`.
 */
export type AuthState =
  | { status: 'loading' | 'unreachable' | 'loggedOut'; session: null; user: null }
  | { status: 'loggedIn'; session: Session; user: User };

interface AuthContextValue {
  state: AuthState;
  /** Try the saved session again (after "Prøv igen" or coming back online). */
  retry: () => void;
  /** Log ud on this device only. Returns false if it failed (e.g. offline). */
  logOut: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const LOADING: AuthState = { status: 'loading', session: null, user: null };
const UNREACHABLE: AuthState = { status: 'unreachable', session: null, user: null };
const LOGGED_OUT: AuthState = { status: 'loggedOut', session: null, user: null };

function fromSession(session: Session | null): AuthState {
  return session ? { status: 'loggedIn', session, user: session.user } : LOGGED_OUT;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(LOADING);
  const statusRef = useRef(state.status);
  statusRef.current = state.status;

  const load = useCallback(async () => {
    const { data, error } = await supabase.auth.getSession();
    // An expired token that can't be refreshed offline comes back as "no
    // session" plus a retryable error. supabase-js keeps it saved, so wait.
    if (error && isAuthRetryableFetchError(error)) setState(UNREACHABLE);
    else setState(fromSession(data.session));
  }, []);

  useEffect(() => {
    void load();
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') return; // load() handles start-up
      // Deferred: Supabase warns against awaiting its calls inside this callback.
      setTimeout(() => setState(fromSession(session)), 0);
    });
    const onOnline = () => {
      if (statusRef.current === 'unreachable') void load();
    };
    window.addEventListener('online', onOnline);
    return () => {
      data.subscription.unsubscribe();
      window.removeEventListener('online', onOnline);
    };
  }, [load]);

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      retry: () => {
        setState(LOADING);
        void load();
      },
      logOut: async () => {
        const { error } = await supabase.auth.signOut({ scope: 'local' });
        return !error;
      },
    }),
    [state, load],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

/** The login state and Log ud. Use inside `<AuthProvider>`. */
export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}

/** The logged-in user. Use only below the logged-in branch of the app. */
export function useUser(): User {
  const { state } = useAuth();
  if (state.status !== 'loggedIn') throw new Error('useUser needs a logged-in user');
  return state.user;
}
