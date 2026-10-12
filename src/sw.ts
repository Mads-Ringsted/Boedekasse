/// <reference lib="webworker" />
// The app's own service worker (vite-plugin-pwa `injectManifest`).
// It is served as /sw.js. NEVER rename or delete it: older iOS versions
// leave installed apps stuck on a service worker whose script is gone.
// Push handlers can be added here later.
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

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
