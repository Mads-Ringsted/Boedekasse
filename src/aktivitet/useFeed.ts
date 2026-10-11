import { useCallback, useEffect, useRef, useState } from 'react';
import type { Haendelse } from './haendelse.ts';
import { hentAktivitetSide, hentSenesteSaeson } from './hentAktivitet.ts';

export interface FeedState {
  status: 'loading' | 'error' | 'ready';
  haendelser: Haendelse[];
  /** More pages exist. */
  flere: boolean;
  /** A next page is on its way. */
  henterFlere: boolean;
  hentFlere: () => void;
  reload: () => void;
}

/**
 * A Sæson's feed (the latest one unless `saesonId` is given), newest first, a
 * page at a time. Starts over from the top when `opdater` changes (pass the
 * Giv / Bøde versions).
 */
export function useFeed(
  bodekasseId: string,
  medlemId: string | undefined,
  opdater: readonly unknown[],
  valgtSaeson?: string,
): FeedState {
  const [status, setStatus] = useState<FeedState['status']>('loading');
  const [haendelser, setHaendelser] = useState<Haendelse[]>([]);
  const [flere, setFlere] = useState(false);
  const [henterFlere, setHenterFlere] = useState(false);
  const [runde, setRunde] = useState(0);
  // The Sæson and the request generation; an answer for an older one is dropped.
  const saeson = useRef<string | null>(null);
  const generation = useRef(0);

  useEffect(() => {
    const gen = ++generation.current;
    setHenterFlere(false);
    (async () => {
      const saesonId = valgtSaeson ?? (await hentSenesteSaeson(bodekasseId));
      if (!saesonId) return { haendelser: [], flere: false, saesonId };
      return { ...(await hentAktivitetSide({ bodekasseId, saesonId, medlemId })), saesonId };
    })().then(
      (svar) => {
        if (gen !== generation.current) return;
        saeson.current = svar.saesonId;
        setHaendelser(svar.haendelser);
        setFlere(svar.flere);
        setStatus('ready');
      },
      () => gen === generation.current && setStatus('error'),
    );
  }, [bodekasseId, medlemId, valgtSaeson, runde, ...opdater]); // the caller lists what should start it over

  const sidste = haendelser[haendelser.length - 1]?.id;
  const hentFlere = useCallback(() => {
    const saesonId = saeson.current;
    if (!flere || henterFlere || !saesonId || sidste === undefined) return;
    const gen = generation.current;
    setHenterFlere(true);
    hentAktivitetSide({ bodekasseId, saesonId, medlemId, foerId: sidste }).then(
      (svar) => {
        if (gen !== generation.current) return;
        setHaendelser((h) => [...h, ...svar.haendelser]);
        setFlere(svar.flere);
        setHenterFlere(false);
      },
      () => gen === generation.current && setHenterFlere(false),
    );
  }, [bodekasseId, medlemId, flere, henterFlere, sidste]);

  const reload = useCallback(() => setRunde((n) => n + 1), []);

  return { status, haendelser, flere, henterFlere, hentFlere, reload };
}
