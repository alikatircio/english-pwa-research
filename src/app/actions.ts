// The only side-effecting layer: domain → storage transaction → dispatch.
// Write first, then change the screen: what is shown is what is on disk.
import type { Clock } from '../domain/clock.ts';
import type { AppDb } from '../storage/db.ts';
import type { Action, AppState, ReadyState } from './state.ts';

export interface ActionDeps {
  db: AppDb;
  clock: Clock;
  getState: () => AppState;
  dispatch: (a: Action) => void;
}

export function readyState(getState: () => AppState): ReadyState | undefined {
  const s = getState();
  return s.status === 'ready' ? s : undefined;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- filled in by T1.8+
export function createActions(_deps: ActionDeps) {
  return {};
}

export type Actions = ReturnType<typeof createActions>;
