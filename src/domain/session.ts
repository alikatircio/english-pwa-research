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
