import { toDayKey } from './dates.ts';
import type { DayKey } from './types.ts';

/** Injected everywhere time matters, so tests (and Playwright's page.clock) control it. */
export interface Clock {
  now(): number;
  today(): DayKey;
}

export const systemClock: Clock = {
  now: () => Date.now(),
  today: () => toDayKey(Date.now()),
};

/** Test helper: a clock pinned to a timestamp that can be moved. */
export function fixedClock(start: number): Clock & { set(ms: number): void; advance(ms: number): void } {
  let t = start;
  return {
    now: () => t,
    today: () => toDayKey(t),
    set: (ms) => {
      t = ms;
    },
    advance: (ms) => {
      t += ms;
    },
  };
}
