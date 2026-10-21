// Pure rules for when a waiting service worker may take over (07 §6.2, 02 §3).
// Kept free of DOM and of `virtual:pwa-register` so Vitest can run it in node.

/** Minimum gap between two `registration.update()` checks (iOS checks rarely by itself). */
export const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

export interface ReloadConditions {
  /** A new service worker is installed and waiting (or already controls the page). */
  updateReady: boolean;
  /** The screen currently shown; only `'home'` is a safe place to reload. */
  screen: string;
  /** A practice round is in progress (even if paused on Home). */
  hasSession: boolean;
  /** `document.visibilityState === 'visible'`. */
  visible: boolean;
}

/**
 * "May we reload now?" Only on Home, with no round in progress, while the page is visible.
 * Never on the card, round end, notebook or settings screens.
 */
export function mayReloadNow(c: ReloadConditions): boolean {
  return c.updateReady && c.screen === 'home' && !c.hasSession && c.visible;
}

/** Whether to call `registration.update()` now; at most once per interval. */
export function shouldCheckForUpdate(
  lastCheckAt: number | undefined,
  now: number,
  intervalMs: number = UPDATE_CHECK_INTERVAL_MS,
): boolean {
  if (lastCheckAt === undefined) return true;
  // Clock moved backwards (manual change): check rather than wait for hours.
  if (now < lastCheckAt) return true;
  return now - lastCheckAt >= intervalMs;
}
