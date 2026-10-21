// Round/session helpers. Slice 1 keeps only the minimal parts; the round
// builder and repeat rules arrive in Slice 4 (07 §3.6).
import type { DayKey, QueueEntry, SessionState } from './types.ts';

export function newSession(queue: readonly QueueEntry[], day: DayKey, now: number): SessionState {
  return {
    key: 'current',
    day,
    startedAt: now,
    updatedAt: now,
    queue: [...queue],
    cursor: 0,
    phase: { tag: 'question' },
    draft: '',
    repeatQueued: [],
    consecutiveWrong: 0,
    studiedChunks: [],
  };
}

export function currentEntry(s: SessionState): QueueEntry | undefined {
  return s.queue[s.cursor];
}

/** 02 §3: a session older than 12 hours is dropped silently. */
export const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;

/** Stale if the queue was built on another day (03 §4.5) or last touched more than 12 h ago. */
export function isSessionStale(s: SessionState, today: DayKey, now: number): boolean {
  return s.day !== today || now - s.updatedAt > SESSION_MAX_AGE_MS;
}
