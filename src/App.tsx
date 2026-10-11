import { useEffect } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { AuthProvider, useAuth } from './auth/AuthProvider.tsx';
import { LogInd } from './auth/LogInd.tsx';
import { BodekasseProvider, useMedlemskaber } from './bodekasse/BodekasseProvider.tsx';
import { StatusScreen } from './components/StatusScreen.tsx';
import { Hjem } from './screens/Hjem.tsx';
import { Mere } from './screens/Mere.tsx';
import { Placeholder } from './screens/Placeholder.tsx';
import { VaelgBodekasse } from './screens/VaelgBodekasse.tsx';
import { Velkommen } from './screens/Velkommen.tsx';
import { AppShell } from './shell/AppShell.tsx';
import { InstallGuide } from './shell/InstallGuide.tsx';
import { isInstalled, readDisplayEnv } from './shell/installed.ts';
import { Offline, useOnline } from './shell/Offline.tsx';
import { UpdatePrompt } from './shell/UpdatePrompt.tsx';
import { t } from './strings/index.ts';

/** The screens inside a box. Shown only once a box is open. */
const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { index: true, element: <Hjem /> },
      { path: 'aktivitet', element: <Placeholder title="skaerm.aktivitet" /> },
      { path: 'kategorier', element: <Placeholder title="skaerm.kategorier" /> },
      { path: 'mere', element: <Mere /> },
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

/** Velkommen, Vælg Bødekasse, or the open box's screens. */
function BoxGate() {
  const { load, destination, reload } = useMedlemskaber();

  if (load.status === 'error') return <StatusScreen message={t('fejl.ukendt')} onRetry={() => void reload()} />;
  switch (destination?.kind) {
    case undefined:
      return <StatusScreen />;
    case 'velkommen':
      return <Velkommen />;
    case 'vaelg':
      return <VaelgBodekasse />;
    case 'bodekasse':
      return <RouterProvider router={router} />;
  }
}
