/// <reference lib="webworker" />
// The app's own service worker (vite-plugin-pwa `injectManifest`).
// It is served as /sw.js. NEVER rename or delete it: older iOS versions
// leave installed apps stuck on a service worker whose script is gone.
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { laesPushBesked, pushMaal } from './push/besked.ts';

declare let self: ServiceWorkerGlobalScope;

// The app shell (HTML, JS, CSS, icons) is precached, so the app opens offline
// and can show "Ingen forbindelse".
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Every in-app URL opens the precached index.html.
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')));

// registerType 'prompt': wait until the user taps "Genindlæs".
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting();
});

// Web Push (#81). Every push shows a notification: iOS revokes the permission
// after a push that shows none.
self.addEventListener('push', (event) => {
  const besked = laesPushBesked(event.data?.text() ?? null);
  event.waitUntil(
    self.registration.showNotification(besked.titel, {
      body: besked.tekst,
      icon: '/pwa-192x192.png',
      data: { url: besked.url },
    }),
  );
});

// A tap opens the push's screen. An open app is focused and told where to go
// (it reloads there, see src/push/aabnPush.ts); otherwise a new window opens.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data as { url?: unknown } | null;
  const url = pushMaal(typeof data?.url === 'string' ? data.url : '/', self.location.origin);
  event.waitUntil(
    (async () => {
      const vinduer = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const vindue = vinduer[0];
      if (vindue) {
        await vindue.focus();
        vindue.postMessage({ type: 'AABN_PUSH', url });
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});
