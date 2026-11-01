import { createContext } from 'react';

/**
 * Called by `<Avatar>` when a picture URL fails to load. `BilledProvider`
 * signs that path again once. Outside the provider it does nothing.
 * Kept apart from the provider so Avatar needs no Supabase import.
 */
export const BilledFejlContext = createContext<(url: string) => void>(() => {});
