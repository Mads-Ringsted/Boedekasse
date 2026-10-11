# iOS PWA constraints (research for #4)

_Researched 2026-10-10 for issue [#4](https://github.com/Mads-Ringsted/Boedekasse/issues/4). Current iOS at time of writing: iOS 27 (Safari 27, with 27.2 in beta)._

**Question:** What can (and can't) a Vite-built PWA do when installed on an iPhone home screen today? Covers install flow, Web Push, auth in standalone mode, storage/eviction, service worker updates, and Vite PWA tooling. The goal is to flag anything that should shape v1.

**How to read the confidence tags**

- **[V]** Verified: read directly in the primary source (Apple developer docs and Safari release notes, MDN source, W3C/WHATWG specs, Supabase docs and source, vite-plugin-pwa docs and source, npm registry).
- **[S]** From a primary source I could not open directly. The sandbox's network proxy blocks `webkit.org`, so WebKit blog posts were read only as search-engine excerpts. The claim is attributed to the post it comes from, but check the wording there before relying on it.
- **[I]** Inference or folk knowledge with no current primary source. Test it on a real device.

---

## TL;DR: constraints on v1 design

1. **Log in inside the installed app.** A Home Screen web app has its own storage, separate from Safari. Since iOS 17.2 only *cookies* are copied over at install time, and supabase-js keeps its session in `localStorage`. Logging in in Safari therefore does not log you in to the installed app. Onboarding should be: open the link → Add to Home Screen → open the app → log in.
2. **Use the 6-digit code, not magic links.** A link tapped in Mail opens Safari, not the installed app, so the session would land in the wrong storage. The Supabase "Magic Link" email template must be edited to include `{{ .Token }}`. Use `autocomplete="one-time-code"` on the code field.
3. **Keep login state across app switches.** iOS may suspend or kill the standalone app while the user is in Mail. Save the pending email (and the "enter code" step) to storage so a relaunch lands back on code entry.
4. **Treat local storage as a cache and Supabase as the source of truth.** For installed apps eviction is unlikely (own 7-day counter, ~60 % disk quota), but it is not guaranteed. Losing local data should only mean logging in again.
5. **Plan for push now, ship it later.** Use `vite-plugin-pwa` with `strategies: 'injectManifest'` (our own service worker, so `push` and `notificationclick` handlers can be added later). Leave room for a `push_subscription` table keyed to the user. Request permission only from a button tap, and never send silent pushes. Web Push requires iOS 16.4+ **and** an installed app. It never works in a Safari tab on iPhone.
6. **Manifest plus Apple tags, safe areas from day one.** Ship a manifest with `display: "standalone"`, a stable `id`, `scope`, `start_url`, icons (including an opaque 1024×1024 or SVG maskable icon), and an `apple-touch-icon` (180×180). Use `viewport-fit=cover` with `env(safe-area-inset-*)` padding, and give `theme-color` both light and dark variants.
7. **Use a prompt for service worker updates, and never rename or delete `sw.js`.** Serve `sw.js` and HTML with `Cache-Control: max-age=0, must-revalidate` on Vercel. Check for updates periodically and when the app becomes visible, because installed apps can stay suspended for days.
8. **Production email needs custom SMTP.** Supabase's built-in SMTP only delivers to the project's team members and is heavily rate limited.

---

## 1. Install flow, manifest, icons, display

### Install

- **There is no install prompt API.** `BeforeInstallPromptEvent` is `version_added: false` for Safari, and iOS mirrors that. Install is always manual: Share → Add to Home Screen. **[V]** [MDN browser-compat-data: BeforeInstallPromptEvent](https://github.com/mdn/browser-compat-data/blob/main/api/BeforeInstallPromptEvent.json)
  → v1 needs an in-app "how to install" hint shown in Safari (detect with `navigator.standalone` or `matchMedia('(display-mode: standalone)')`).
- **iOS 26+: every site added to the Home Screen opens as a web app by default.** Safari 26.0 release note: "Added support for any website to become a web app on iOS or iPadOS." **[V]** [Safari 26.0 release notes](https://developer.apple.com/documentation/safari-release-notes/safari-26-release-notes). The user can turn off an "Open as Web App" toggle in the add sheet. The manifest becomes optional, but its icons and other members are still used if present. **[S]** [WebKit: News from WWDC25](https://webkit.org/blog/16993/news-from-wwdc25-web-technology-coming-this-fall-in-safari-26-beta/), [WebKit Features in Safari 26.0](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/)
- **Before iOS 26**, opening standalone required a manifest with `display: standalone` or `fullscreen` (or the legacy `apple-mobile-web-app-capable` meta). Otherwise the icon opened Safari. **[S]** [WebKit: Web Push for Web Apps on iOS and iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/). Legacy meta: **[V]** [Apple: Configuring Web Applications (archived, 2016)](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html)
- **Third-party browsers** (Chrome, Firefox and others on iOS) can offer Add to Home Screen from the Share menu since iOS 16.4. **[V]** [Safari 16.4 release notes](https://developer.apple.com/documentation/safari-release-notes/safari-16_4-release-notes)
- **EU (Denmark):** Apple briefly planned to drop Home Screen web apps in the EU in iOS 17.4, then reversed. They remain, built on WebKit regardless of the user's default browser. **[S]** (Apple developer Q&A as quoted in press coverage, e.g. [iMore](https://imore.com/ios/apple-backtracks-ios-174-web-app-changes-in-eu-just-weeks-after-citing-security-and-privacy-concerns)). This matters because all WebKit limits below apply even to Danish users with Chrome as their default browser.

### Manifest members that matter on iOS

- `id` is supported since 16.4 and is used to sync Focus settings across devices. **[V]** 16.4 notes; **[S]** WebKit 13878. Pick a stable `id` now; changing it later effectively creates a new app.
- `scope` is respected since 17.2 (bug fix). **[V]** [Safari 17.2 release notes](https://developer.apple.com/documentation/safari-release-notes/safari-17_2-release-notes)
- The 18.2 parser trims ASCII whitespace in manifest values. **[V]** 18.2 notes.
- `display` fallback chain: `fullscreen` → `standalone` → `minimal-ui` → `browser`. **[V]** [MDN: display](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/display). Use `standalone`.

### Icons and splash

- Apple's guidance (Safari 17.2): "supply at least one opaque, full-bleed `maskable` square icon in the web app manifest, either as an SVG (any size) or high resolution bitmap (1024x1024)". Safari may fall back to `apple-touch-icon`. Don't omit `apple-touch-icon` links based on user-agent detection. **[V]** 17.2 notes. (The note sits in a section that is mostly about macOS web apps.)
- `apple-touch-icon` at 180×180 is the iPhone size. `@vite-pwa/assets-generator` produces it from one source image. **[V]** [vite-pwa: PWA Assets Generator](https://vite-pwa-org.netlify.app/assets-generator/), [vite-pwa: minimal requirements](https://vite-pwa-org.netlify.app/guide/pwa-minimal-requirements)
- Launch screen: `<link rel="apple-touch-startup-image">`. By default iOS shows a screenshot of the app's last launch. **[V]** Apple archived doc (2016). Images must match each device size, so this is low priority for v1.

### Standalone display: status bar, safe areas, dark mode

- **Status bar:** `<meta name="apple-mobile-web-app-status-bar-style" content="default|black|black-translucent">`. It only has an effect in standalone mode, and `black-translucent` lets content run under the status bar. **[V]** Apple archived doc. **[I]** I found no current Apple doc. It is still honored in practice, but test it on iOS 26/27.
- **Safe areas:** `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">` plus `env(safe-area-inset-top|right|bottom|left)`. Fixed bottom bars need `padding-bottom: calc(… + env(safe-area-inset-bottom))`. **[V]** [MDN: viewport meta](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meta/name/viewport), [MDN: env()](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/env)
- **Dark mode:** `theme-color` accepts a `media` attribute, so you can provide both: `<meta name="theme-color" media="(prefers-color-scheme: dark)" content="…">`. **[V]** [MDN: theme-color](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meta/name/theme-color). Use `color-scheme` and `prefers-color-scheme` CSS for the app itself.
- **Detect standalone mode:** `@media (display-mode: standalone)` **[V]** MDN display, or `navigator.standalone` **[V]** Apple archived doc.

---

## 2. Web Push

### Requirements and permission flow

- **iOS/iPadOS 16.4+, Home Screen web apps only.** **[V]** [Apple: Sending web push notifications in web apps and browsers](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers), 16.4 notes ("Added support for Web Push in web apps saved to the home screen on iOS"). A Safari tab on iPhone cannot request push permission. **[S]** WebKit 13878.
- **Permission only from a user gesture:** "Provide a method for the user to grant permission with a gesture, such as clicking or tapping a button. When the user completes the gesture, call the push subscription method immediately from the gesture's event handler code." **[V]** Apple doc. MDN says the same for `subscribe()`. **[V]** [MDN: PushManager.subscribe](https://developer.mozilla.org/en-US/docs/Web/API/PushManager/subscribe)
- **No silent push:** "Safari doesn't support invisible push notifications. Present push notifications to the user immediately after your service worker receives them. If you don't, Safari revokes the push notification permission for your site." **[V]** Apple doc. Always pass `userVisibleOnly: true`.
- **No Apple Developer Program, no APNs certificates.** Use standard VAPID ([draft-ietf-webpush-vapid](https://datatracker.ietf.org/doc/html/draft-ietf-webpush-vapid-00)), payload encryption, and [RFC 8030](https://datatracker.ietf.org/doc/html/rfc8030). Endpoints are on `*.push.apple.com`, so allow egress to it. **[V]** Apple doc.
- **Server response codes** to handle: `410` (subscription expired: delete it), `413` (payload too large), `429` (too many requests to the same destination). Keep at most 100 unacknowledged requests per HTTP/1.1 connection and respect HTTP/2 `SETTINGS_MAX_CONCURRENT_STREAMS`. **[V]** Apple doc.
- **Badging:** `navigator.setAppBadge(n)` / `clearAppBadge()`, with badge permission managed in iOS Notification settings (16.4+). **[V]** Apple doc, 16.4 notes. Badge permission is granted together with notification permission. **[S]** WebKit 13878. This fits the Saldo use case (e.g. a badge for unpaid Bøder).
- Push subscriptions are per Safari profile (17.0). **[V]** 17.0 notes.
- **Reliability fixes landed late:** "Fixed several issues that caused Web Push to not show notifications when the web app or Safari was not already running" in 17.5. In 17.2, tapping a notification more than 30 s after delivery failed to open the web app. **[V]** 17.5 and 17.2 notes. Expect a reliable experience only on iOS 17.5+.

### Declarative Web Push (iOS 18.4+)

- Supported on iOS since Safari 18.4 and on macOS since 18.5. **[V]** [18.4 notes](https://developer.apple.com/documentation/safari-release-notes/safari-18_4-release-notes), 18.5 notes. The server sends JSON that the system displays **without running service worker JavaScript**. A service worker can optionally modify `mutable` messages. It is backwards compatible with classic Web Push. **[S]** [WebKit: Meet Declarative Web Push](https://webkit.org/blog/16535/meet-declarative-web-push/). Explainer: **[V]** [WebKit explainers: DeclarativeWebPush](https://github.com/WebKit/explainers/tree/main/DeclarativeWebPush)
- The payload format is now in the W3C Push API editor's draft: `{"web_push": 8030, "notification": {"title": "...", "body": "...", "navigate": "https://..."}}`, with optional `app_badge` and `mutable`. **[V]** [W3C Push API (ED): declarative push message](https://w3c.github.io/push-api/)
- **For Bødekasse:** send declarative payloads and keep a small `push` handler in the service worker as a fallback for iOS 16.4–18.3 and other browsers. This avoids the "no silent push" revocation risk.

### Sending from Supabase

- Supabase docs only cover Expo/FCM mobile push. There is no Web Push guide, so this is ours to build. **[V]** [Supabase: Push notifications](https://supabase.com/docs/guides/functions/examples/push-notifications)
- Edge Functions (Deno) can import `npm:` and `jsr:` packages. **[V]** [Supabase: Managing dependencies](https://supabase.com/docs/guides/functions/dependencies). Candidate libraries:
  - [`web-push`](https://www.npmjs.com/package/web-push) on npm: 3.6.7, last published 2024-01-16, built for Node. **[V]** npm registry. **[I]** Whether it runs under Deno's Node compatibility layer is untested.
  - [`@negrel/webpush`](https://jsr.io/@negrel/webpush) on JSR: 0.5.0, Deno-native. **[V]** that it exists. **[I]** Its quality is unchecked.
- Edge Function limits: 2 s CPU per request, 256 MB memory, wall clock 150 s (free plan) or 400 s (paid). **[V]** [Supabase: Edge Function limits](https://supabase.com/docs/guides/functions/limits). Fan-out to the Medlemmer of one Bødekasse (tens of people) fits easily.
- **Keep the v1 data model open for this:** a `push_subscription` table (endpoint, `p256dh`, `auth`, user id, created/last-seen). Store VAPID keys as Edge Function secrets. Trigger sends from DB events (e.g. new Bøde, Anke outcome). Nothing here forces any v1 decision beyond "don't use `generateSW`" (see §5).

---

## 3. Auth in standalone mode

### Storage is not shared with Safari

- Safari 17.2: "Added support for copying cookies when saving a website to the Home Screen on iOS and iPadOS." **[V]** 17.2 notes. Only cookies are copied, once, at install time. `localStorage`, IndexedDB and other storage are not copied, and after that the app and Safari stay isolated. **[S]** (WWDC23 "What's new in web apps", via [WWDC Notes](https://wwdcnotes.com/documentation/wwdc23-10120-whats-new-in-web-apps/).) The 17.2 note implies separate stores, and the "cookies only" detail comes from the session.
- **supabase-js stores the session in `localStorage`** (`persistSession: true`, `storage = globalThis.localStorage`), not in cookies. **[V]** [supabase-js `GoTrueClient.ts`](https://github.com/supabase/supabase-js/blob/master/packages/core/auth-js/src/GoTrueClient.ts). A Safari login therefore never carries into the installed app. **The user must log in inside the installed app.**
- Opening links straight into a web app is listed only for **macOS** (Safari 18). **[V]** 18.0 notes. 17.2 also fixed "sign in pages sometimes unexpectedly open in Safari instead of the web app". **[V]** **[I]** On iPhone, a link tapped in Mail opens Safari. A magic link would therefore log in the Safari copy, not the app. This is why the 6-digit email code is the right choice.

### Session lifetime (Supabase)

- Access token (JWT): default 1 h. Refresh tokens **never expire** but are single-use. A 10 s reuse window plus a "parent token" exception protect clients that lost the refresh response (useful when iOS suspends the app mid-request). **[V]** [Supabase: User sessions](https://supabase.com/docs/guides/auth/sessions)
- Optional "time-boxed sessions" and "inactivity timeout" exist but are off by default. **[V]** same page. With the defaults, a Medlem stays logged in indefinitely as long as local storage survives.
- supabase-js refreshes only while the page is visible. On `visibilitychange` → visible it restarts auto-refresh and recovers the session. **[V]** `GoTrueClient.ts` (`_onVisibilityChanged`). Reopening the app after days refreshes the token transparently.

### Email OTP flow

- Supabase email OTP shares an implementation with magic links. To send a code, **edit the "Magic Link" email template to include `{{ .Token }}`**. **[V]** [Supabase: Passwordless email logins](https://supabase.com/docs/guides/auth/auth-email-passwordless)
- Code length is 6 by default (configurable 6–10). The resend interval is 1 minute (SMTP max frequency). If unset, OTP expiry defaults to 86,400 s in the Auth server code. Hosted projects set it under Auth → Email → "Email OTP expiration", and more than 1 day is discouraged. **[V]** [supabase/auth `configuration.go`](https://github.com/supabase/auth/blob/master/internal/conf/configuration.go), passwordless docs.
- **Built-in SMTP is not for production.** It only delivers to the project's team members and has a low, changeable hourly limit. With custom SMTP the initial limit is 30 messages per hour, which can be adjusted. **[V]** [Supabase: Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [Rate limits](https://supabase.com/docs/guides/auth/rate-limits). This is a v1 launch constraint.
- **Code entry UX:**
  - `autocomplete="one-time-code"` is supported in Safari since 17.2. **[V]** 17.2 notes, [MDN: autocomplete](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/autocomplete). Add `inputmode="numeric"`.
  - iOS 17 added AutoFill of verification codes received in **Mail** (previously only Messages). **[S]** (Apple's iOS 17 feature list, as quoted in secondary coverage.)
  - 17.2 fixed AutoFill settings not applying in web apps. **[V]**
  - **[I]** Developers report Mail-code AutoFill doesn't always trigger. Whether it works inside a Home Screen web app is unverified. Design for manual entry and paste (accept a pasted 6-digit string, strip spaces).
- **Switching to Mail and back:** since iOS 12.2 a backgrounded standalone app is frozen, not reloaded. Under memory pressure it can still be killed, and relaunch loads the start URL. **[I]** This is older third-party reporting (e.g. [Maximiliano Firtman on iOS 12.2](https://medium.com/@firt/whats-new-on-ios-12-2-for-progressive-web-apps-75c348f8e945)) with no current Apple source. **Mitigation:** store `pendingEmail` and the code-entry step in `sessionStorage`/`localStorage` and restore it on launch.

---

## 4. Storage limits and eviction

- **Quota (Safari 17+):** in browser apps each origin gets about 60 % of total disk. Other WebKit-embedding apps get about 15 %, **but a site saved as a Home Screen web app uses the browser quota (about 60 %)**. The overall cap is about 80 % of disk. Before Safari 17 the limit was 1 GiB, after which the browser asked the user. **[V]** [MDN: Storage quotas and eviction criteria](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria), citing [WebKit: Updates to Storage Policy](https://webkit.org/blog/14403/updates-to-storage-policy/). The full Storage API and `navigator.storage.estimate()` are available since 17.0. **[V]** 17.0 notes.
- `navigator.storage.persist()`: Safari grants or denies it automatically based on how the user interacts with the site, with no prompt. **[V]** MDN.
- **Proactive (ITP) eviction:** with tracking prevention on, an origin with no user interaction in the last 7 days of browser use loses its script-written storage (localStorage, IndexedDB, service worker registrations and caches). Server-set cookies are exempt. **[V]** MDN. **Home Screen web apps keep their own days-of-use counter**, which actual use resets. WebKit "does not expect" first-party data in such apps to be deleted and would treat it as a bug. **[S]** [WebKit: Full Third-Party Cookie Blocking and More](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/). Not opening the app does not advance its counter.
- Eviction deletes all of an origin's data at once. **[V]** MDN. 17.4 fixed "cases where website data is unexpectedly evicted". **[V]** 17.4 notes.
- **Conclusion for v1:** quota is not a concern for this app's data volume. Treat everything local as a cache. The only thing that really matters is the Supabase session, and losing it means "log in again".

---

## 5. Service worker updates and Vite tooling

### vite-plugin-pwa

- **Current version:** **2.0.0**, published 2026-10-03, one week ago. The previous release was 1.3.0 (2026-05-05). v2 requires **Node ≥ 20.19.0**. Peer dependencies: Vite `^3.1 … ^8`, `workbox-build`/`workbox-window` `^7.4.1`, `@vite-pwa/assets-generator` `^1 || ^2`. **[V]** [npm registry](https://registry.npmjs.org/vite-plugin-pwa), [README](https://github.com/vite-pwa/vite-plugin-pwa). **[I]** I could not read the v2.0.0 release notes (GitHub API blocked in this sandbox). Check them for breaking changes before pinning. Pinning 1.3.x is the conservative alternative.
- It generates the manifest, the service worker (Workbox) and the registration script. React gets `useRegisterSW()` from `virtual:pwa-register/react`, which exposes `needRefresh` and `offlineReady`. **[V]** [vite-pwa: Getting started](https://vite-pwa-org.netlify.app/guide/), [React](https://vite-pwa-org.netlify.app/frameworks/react)
- **Strategy:** `generateSW` produces a service worker you don't edit. `injectManifest` compiles **your own** service worker and injects the precache list. **[V]** [vite-pwa: injectManifest](https://vite-pwa-org.netlify.app/guide/inject-manifest). Web Push needs our own `push` and `notificationclick` handlers, so **use `injectManifest` from v1** to avoid switching strategies later.

### Update behaviour

- `registerType: 'autoUpdate'` forces `skipWaiting` + `clientsClaim` and reloads open clients. The docs warn that "the user can lose data … filling in a form" and recommend `prompt` for apps with forms. **[V]** [vite-pwa: Automatic reload](https://vite-pwa-org.netlify.app/guide/auto-update), [Prompt for update](https://vite-pwa-org.netlify.app/guide/prompt-for-update). Giving a Bøde is a short form, so use `prompt` (an "Ny version – genindlæs" toast).
- **Installed apps can stay suspended for a long time** **[I]**, so update checks on navigation alone are not enough. Call `registration.update()` on an interval **[V]** [vite-pwa: Periodic SW updates](https://vite-pwa-org.netlify.app/guide/periodic-sw-updates) and also on `visibilitychange` → visible **[I]** (our own addition).
- **Vercel headers:** serve `/sw.js` and `*.html` with `Cache-Control: public, max-age=0, must-revalidate`, hashed `/assets/*` with `max-age=31536000, immutable`, and the manifest with `application/manifest+json`. **[V]** [vite-pwa: Deploy to Vercel](https://vite-pwa-org.netlify.app/deployment/vercel)
- **Never rename or 404 the service worker script.** Only Safari 26.6/27 fixed "service worker registrations with missing main scripts were not automatically unregistered, preventing pages from re-registering new service workers". **[V]** [26.6 notes](https://developer.apple.com/documentation/safari-release-notes/safari-26_6-release-notes), [27 notes](https://developer.apple.com/documentation/safari-release-notes/safari-27-release-notes). On older iOS, renaming the script can leave installed apps stuck on a dead service worker.
- Safari 27 adds the service worker static routing API. **[V]** 27 notes. Nice to have, not needed.

---

## 6. Suggested minimum iOS target

- **Hard floor for push:** iOS 16.4. **[V]**
- **Recommended support floor:** iOS 17.5. Reasons: Mail OTP AutoFill (17), `one-time-code` (17.2), cookie copy on install (17.2), the modern storage quota (17), and Web Push delivery fixes when the app isn't running (17.5). **[V]** release notes above.
- **Best experience:** iOS 18.4+ (Declarative Web Push) and iOS 26+ (any site installs as a web app; manifest optional).

## Open items (need a real iPhone)

- Does Mail-code AutoFill appear for our OTP email inside the installed app (iOS 26/27)?
- Is `apple-mobile-web-app-status-bar-style=black-translucent` still honored on iOS 26/27 with `viewport-fit=cover`?
- After switching to Mail for a few minutes and back, does the app resume or relaunch at `start_url`?
- What changed in vite-plugin-pwa 2.0.0 (release notes)?
- Does `web-push` (npm) work in a Supabase Edge Function, or should we use `@negrel/webpush`?
