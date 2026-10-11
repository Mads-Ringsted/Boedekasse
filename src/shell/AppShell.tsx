import { useState } from 'react';
import { Outlet } from 'react-router';
import { Sheet } from '../components/Sheet.tsx';
import { t } from '../strings/index.ts';
import { TabBar } from './TabBar.tsx';

/** The installed app: the current screen, the tab bar and Giv bøder. */
export function AppShell() {
  const [giving, setGiving] = useState(false);

  return (
    <>
      <Outlet />
      <TabBar onGive={() => setGiving(true)} />
      <Sheet open={giving} onOpenChange={setGiving} height="full" title={t('giv.titel')}>
        <p className="screen__placeholder">{t('skaerm.kommerSnart')}</p>
      </Sheet>
    </>
  );
}
