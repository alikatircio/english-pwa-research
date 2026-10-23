/// <reference types="vite-plugin-pwa/vanillajs" />
// Service worker registration and the "update only on Home" rule (07 §6.2, 02 §3).
//
// Wiring (two calls, no React state needed):
//   1. main.tsx, once at boot:            startServiceWorker();
//   2. HomeScreen, while Home is shown:
//        useEffect(() => applyUpdateOnHome({ hasSession: session !== undefined }), [session]);
//      It tries once on mount and again on every `visibilitychange → visible`;
//      the returned function removes the listener on unmount.
//
// A new version that arrives while the user is already on Home is NOT applied until the
// next Home mount or the next return to the app, so a tap is never interrupted. When the
// new SW finally takes control, Home is checked again before reloading: if the user has
// left Home (or started a round) meanwhile, the reload waits for the next safe Home moment.
import { registerSW } from 'virtual:pwa-register';
import { markUpdateApplied } from './updateNote.ts';
import { mayReloadNow, shouldCheckForUpdate } from './updatePolicy.ts';

let started = false;
/** A new SW is waiting, or (via another tab) already controls this page. */
let updateReady = false;
/** The new SW already took control elsewhere; only a reload is left to do. */
let controllerChanged = false;
/** We asked the waiting SW to activate (or are reloading); `onNeedReload` re-checks Home before reloading. */
let applying = false;
let activateWaitingSW: (() => Promise<void>) | undefined;
/** Set while Home is mounted (applyUpdateOnHome); undefined on every other screen. */
let home: { hasSession: boolean } | undefined;
let registration: ServiceWorkerRegistration | undefined;
let lastCheckAt: number | undefined;

/** Registers the SW (production builds only). Safe to call more than once. */
export function startServiceWorker(): void {
  if (started || !import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  started = true;

  activateWaitingSW = registerSW({
    onNeedRefresh() {
      updateReady = true;
    },
    onNeedReload() {
      // The new SW controls the page now. Activation can take a while (cache cleanup), and
      // the user may have left Home meanwhile (e.g. tapped "Başla"): check again (09 #2).
      const requested = applying;
      applying = false;
      controllerChanged = true;
      updateReady = true;
      if (requested && safeToReload()) reload();
      // Otherwise (another screen, a round open, or activated from another tab): the reload
      // waits for the next safe Home moment (Home mount or return to the app).
    },
    onRegisteredSW(_swUrl, reg) {
      registration = reg;
      lastCheckAt = Date.now();
    },
    onRegisterError(error: unknown) {
      console.warn('Service worker registration failed', error);
    },
  });

  // iOS rarely checks for a new SW on its own: ask when the app comes back, at most hourly.
  document.addEventListener('visibilitychange', checkForUpdate);
}

function checkForUpdate(): void {
  if (document.visibilityState !== 'visible' || !registration) return;
  const now = Date.now();
  if (!shouldCheckForUpdate(lastCheckAt, now)) return;
  lastCheckAt = now;
  // Offline or a check already in flight: try again next time.
  registration.update().catch(() => undefined);
}

/** Home is shown with no round open and the page is visible, right now. */
function safeToReload(): boolean {
  const visible = document.visibilityState === 'visible';
  return mayReloadNow({ updateReady, screen: home ? 'home' : 'other', hasSession: home?.hasSession ?? true, visible });
}

function reload(): void {
  applying = true;
  markUpdateApplied();
  window.location.reload();
}

function tryApplyOnHome(): void {
  if (applying || !safeToReload()) return;
  if (controllerChanged) {
    reload();
  } else {
    applying = true;
    // Sends SKIP_WAITING; the page reloads once the new SW controls it (`onNeedReload`).
    void activateWaitingSW?.();
  }
}

/**
 * Call while the Home screen is mounted. Applies a waiting update now if it is safe, and
 * again whenever the app becomes visible. Returns a cleanup function (use it as the
 * `useEffect` return value).
 */
export function applyUpdateOnHome({ hasSession }: { hasSession: boolean }): () => void {
  const mounted = { hasSession };
  home = mounted;
  tryApplyOnHome();
  const onVisibility = () => {
    if (document.visibilityState === 'visible') tryApplyOnHome();
  };
  document.addEventListener('visibilitychange', onVisibility);
  return () => {
    if (home === mounted) home = undefined;
    document.removeEventListener('visibilitychange', onVisibility);
  };
}
