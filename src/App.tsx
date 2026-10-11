import { useEffect, useState } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { Aktivitet } from './aktivitet/Aktivitet.tsx';
import { AuthProvider, useAuth } from './auth/AuthProvider.tsx';
import { LogInd } from './auth/LogInd.tsx';
import { BodekasseProvider, useMedlemskaber } from './bodekasse/BodekasseProvider.tsx';
import { Kassen } from './kassen/Kassen.tsx';
import { Indstillinger } from './indstillinger/Indstillinger.tsx';
import { Kategorier } from './kategorier/Kategorier.tsx';
import { KonkurrenceDetalje } from './konkurrence/KonkurrenceDetalje.tsx';
import { Konkurrencer } from './konkurrence/Konkurrencer.tsx';
import { StatusScreen } from './components/StatusScreen.tsx';
import { JegHarEnKode } from './onboarding/JegHarEnKode.tsx';
import { OnboardingProvider, type OnboardingSide } from './onboarding/Onboarding.tsx';
import { OpretBodekasse } from './onboarding/OpretBodekasse.tsx';
import { Hjem } from './screens/Hjem.tsx';
import { Medlemmer } from './screens/Medlemmer.tsx';
import { Mere } from './screens/Mere.tsx';
import { ProfilRute } from './profil/ProfilSkaerm.tsx';
import { Placeholder } from './screens/Placeholder.tsx';
import { VaelgBodekasse } from './screens/VaelgBodekasse.tsx';
import { Velkommen } from './screens/Velkommen.tsx';
import { AppShell } from './shell/AppShell.tsx';
import { InstallGuide } from './shell/InstallGuide.tsx';
import { isInstalled, readDisplayEnv } from './shell/installed.ts';
import { Offline, useOnline } from './shell/Offline.tsx';
import { UpdatePrompt } from './shell/UpdatePrompt.tsx';
import { t } from './strings/index.ts';

const fraMere = { label: 'tab.mere', to: '/mere' } as const;

/** The screens inside a box. Shown only once a box is open. */
const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { index: true, element: <Hjem /> },
      { path: 'aktivitet', element: <Aktivitet /> },
      { path: 'kategorier', element: <Kategorier /> },
      { path: 'mere', element: <Mere /> },
      // Pushed from Mere; each ticket replaces its stand-in.
      { path: 'profil', element: <ProfilRute /> },
      { path: 'medlem/:medlemId', element: <ProfilRute /> },
      { path: 'medlemmer', element: <Medlemmer /> },
      { path: 'kassen', element: <Kassen /> },
      { path: 'anker', element: <Placeholder title="mere.anker" back={fraMere} /> },
      { path: 'konkurrencer', element: <Konkurrencer /> },
      { path: 'konkurrencer/:id', element: <KonkurrenceDetalje /> },
      { path: 'indstillinger', element: <Indstillinger /> },
      { path: '*', element: <Hjem /> },
    ],
  },
]);

const installed = isInstalled(readDisplayEnv());

export function App() {
  const online = useOnline();

  if (!installed) return <InstallGuide />;

  return (
    <>
      <AuthProvider>
        <LoginGate />
      </AuthProvider>
      <UpdatePrompt />
      {!online && <Offline />}
    </>
  );
}

/** Log ind until there is a session; then the person's box. */
function LoginGate() {
  const { state, retry } = useAuth();

  // After Log ud, the next login starts on Hjem, not where the last person was.
  useEffect(() => {
    if (state.status === 'loggedOut') void router.navigate('/', { replace: true });
  }, [state.status]);

  switch (state.status) {
    case 'loading':
      return <StatusScreen />;
    case 'unreachable':
      return <StatusScreen message={t('offline.proevIgen')} onRetry={retry} />;
    case 'loggedOut':
      return <LogInd />;
    case 'loggedIn':
      return (
        <BodekasseProvider key={state.user.id}>
          <BoxGate />
        </BodekasseProvider>
      );
  }
}

/**
 * Velkommen, Vælg Bødekasse, or the open box's screens. Opret Bødekasse and
 * Jeg har en kode cover all of them when opened (`useVisOnboarding`).
 */
function BoxGate() {
  const { load, destination, reload, switchTo } = useMedlemskaber();
  const [side, setSide] = useState<OnboardingSide | null>(null);

  // A new or joined box: fetch the boxes again, open it on Hjem.
  async function aabnNyKasse(bodekasseId: string) {
    await reload();
    switchTo(bodekasseId);
    await router.navigate('/', { replace: true });
    setSide(null);
  }

  let content;
  if (side === 'opret') {
    content = <OpretBodekasse onBack={() => setSide(null)} onCreated={aabnNyKasse} />;
  } else if (side === 'kode') {
    content = <JegHarEnKode onBack={() => setSide(null)} onJoined={aabnNyKasse} />;
  } else if (load.status === 'error') {
    content = <StatusScreen message={t('fejl.ukendt')} onRetry={() => void reload()} />;
  } else {
    switch (destination?.kind) {
      case undefined:
        content = <StatusScreen />;
        break;
      case 'velkommen':
        content = <Velkommen />;
        break;
      case 'vaelg':
        content = <VaelgBodekasse />;
        break;
      case 'bodekasse':
        // Keyed by box, so switching box starts every screen fresh.
        content = <RouterProvider key={destination.bodekasseId} router={router} />;
        break;
    }
  }

  return <OnboardingProvider value={setSide}>{content}</OnboardingProvider>;
}
