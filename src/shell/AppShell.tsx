import { Outlet } from 'react-router';
import { BoedeDetaljeProvider } from '../aktivitet/boede/BoedeDetaljeProvider.tsx';
import { BilledProvider } from '../billeder/BilledProvider.tsx';
import { GivBoederProvider, useGivBoeder } from '../giv/GivBoederProvider.tsx';
import { SaesonProvider, useSaeson } from '../saeson/SaesonProvider.tsx';
import { TabBar } from './TabBar.tsx';

/** The installed app: the current screen, the tab bar, Giv bøder, the Bøde detail sheet and the box's Profilbilleder. */
export function AppShell() {
  return (
    <BilledProvider>
      <SaesonProvider>
        <GivBoederProvider>
          <BoedeDetaljeProvider>
            <Outlet />
            <GivTabBar />
          </BoedeDetaljeProvider>
        </GivBoederProvider>
      </SaesonProvider>
    </BilledProvider>
  );
}

function GivTabBar() {
  const { aabn } = useGivBoeder();
  const { pause } = useSaeson();
  return <TabBar onGive={() => aabn()} giveDisabled={pause} />;
}
