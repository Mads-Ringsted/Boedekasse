import { Outlet } from 'react-router';
import { BoedeDetaljeProvider } from '../aktivitet/boede/BoedeDetaljeProvider.tsx';
import { GivBoederProvider, useGivBoeder } from '../giv/GivBoederProvider.tsx';
import { SaesonProvider, useSaeson } from '../saeson/SaesonProvider.tsx';
import { TabBar } from './TabBar.tsx';

/** The installed app: the current screen, the tab bar, Giv bøder and the Bøde detail sheet. */
export function AppShell() {
  return (
    <SaesonProvider>
      <GivBoederProvider>
        <BoedeDetaljeProvider>
          <Outlet />
          <GivTabBar />
        </BoedeDetaljeProvider>
      </GivBoederProvider>
    </SaesonProvider>
  );
}

function GivTabBar() {
  const { aabn } = useGivBoeder();
  const { pause } = useSaeson();
  return <TabBar onGive={() => aabn()} giveDisabled={pause} />;
}
