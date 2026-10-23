// "Güncellendi" note after the service worker applied an update.
// registerSW.ts raises a sessionStorage flag just before the reload; the next Home render
// shows the note only if the build id stored in meta differs from the running one.
import type { BuildInfo } from '../buildInfo.ts';

const FLAG_KEY = 'updateApplied';

/** One id per shipped build: a new version or a new commit both count as an update. */
export function buildId(b: BuildInfo): string {
  return `${b.version}+${b.sha}`;
}

export function markUpdateApplied(): void {
  try {
    sessionStorage.setItem(FLAG_KEY, '1');
  } catch {
    // Storage blocked: no note, nothing else lost.
  }
}

export function takeUpdateFlag(peek = false): boolean {
  try {
    const set = sessionStorage.getItem(FLAG_KEY) === '1';
    if (set && !peek) sessionStorage.removeItem(FLAG_KEY);
    return set;
  } catch {
    return false;
  }
}

/** Show the note only after an applied update and only when the previous build id is known and different. */
export function shouldShowUpdatedNote(input: { flagged: boolean; lastSeen: string | undefined; current: string }): boolean {
  return input.flagged && input.lastSeen !== undefined && input.lastSeen !== input.current;
}
