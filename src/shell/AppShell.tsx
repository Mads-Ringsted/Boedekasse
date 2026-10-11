import { Outlet } from 'react-router';
import { GivBoederProvider, useGivBoeder } from '../giv/GivBoederProvider.tsx';
import { TabBar } from './TabBar.tsx';

/** The installed app: the current screen, the tab bar and Giv bøder. */
export function AppShell() {
  return (
    <GivBoederProvider>
      <Outlet />
      <GivTabBar />
    </GivBoederProvider>
  );
}

function GivTabBar() {
  const { aabn } = useGivBoeder();
  // #67 passes giveDisabled during a Pause.
  return <TabBar onGive={() => aabn()} />;
}
