import { Outlet } from 'react-router';
import { BoedeDetaljeProvider } from '../aktivitet/boede/BoedeDetaljeProvider.tsx';
import { GivBoederProvider, useGivBoeder } from '../giv/GivBoederProvider.tsx';
import { TabBar } from './TabBar.tsx';

/** The installed app: the current screen, the tab bar, Giv bøder and the Bøde detail sheet. */
export function AppShell() {
  return (
    <GivBoederProvider>
      <BoedeDetaljeProvider>
        <Outlet />
        <GivTabBar />
      </BoedeDetaljeProvider>
    </GivBoederProvider>
  );
}

function GivTabBar() {
  const { aabn } = useGivBoeder();
  // #67 passes giveDisabled during a Pause.
  return <TabBar onGive={() => aabn()} />;
}
