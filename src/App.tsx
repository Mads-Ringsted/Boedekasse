import { createBrowserRouter, RouterProvider } from 'react-router';
import { Placeholder } from './screens/Placeholder.tsx';
import { AppShell } from './shell/AppShell.tsx';
import { InstallGuide } from './shell/InstallGuide.tsx';
import { isInstalled, readDisplayEnv } from './shell/installed.ts';
import { Offline, useOnline } from './shell/Offline.tsx';
import { UpdatePrompt } from './shell/UpdatePrompt.tsx';

const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { index: true, element: <Placeholder title="skaerm.hjem" /> },
      { path: 'aktivitet', element: <Placeholder title="skaerm.aktivitet" /> },
      { path: 'kategorier', element: <Placeholder title="skaerm.kategorier" /> },
      { path: 'mere', element: <Placeholder title="skaerm.mere" /> },
      { path: '*', element: <Placeholder title="skaerm.hjem" /> },
    ],
  },
]);

const installed = isInstalled(readDisplayEnv());

export function App() {
  const online = useOnline();

  if (!installed) return <InstallGuide />;

  return (
    <>
      <RouterProvider router={router} />
      <UpdatePrompt />
      {!online && <Offline />}
    </>
  );
}
