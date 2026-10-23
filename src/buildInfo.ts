// What this bundle is: injected by Vite `define` (vite.config.ts).
export interface BuildInfo {
  version: string;
  /** ISO date, YYYY-MM-DD. */
  date: string;
  sha: string;
  contentVersion: string;
}

export const BUILD: BuildInfo = {
  version: __APP_VERSION__,
  date: __BUILD_DATE__,
  sha: __GIT_SHA__,
  contentVersion: __CONTENT_VERSION__,
};
