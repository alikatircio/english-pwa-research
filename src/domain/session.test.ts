import { describe, expect, it } from 'vitest';
import { currentEntry, isSessionStale, newSession, SESSION_MAX_AGE_MS } from './session.ts';

const day = '2026-11-02';
const t0 = new Date(2026, 10, 2, 8).getTime();

describe('newSession / currentEntry', () => {
  it('starts at the first card in question phase with an empty draft', () => {
    const s = newSession([{ itemId: 'a', kind: 'new' }, { itemId: 'b', kind: 'new' }], day, t0);
    expect(s).toMatchObject({ key: 'current', day, cursor: 0, phase: { tag: 'question' }, draft: '', startedAt: t0, updatedAt: t0 });
    expect(currentEntry(s)).toEqual({ itemId: 'a', kind: 'new' });
    expect(currentEntry({ ...s, cursor: 2 })).toBeUndefined();
  });
});

describe('isSessionStale', () => {
  const s = newSession([{ itemId: 'a', kind: 'new' }], day, t0);
  it('is fresh on the same day within 12 hours', () => {
    expect(isSessionStale(s, day, t0 + SESSION_MAX_AGE_MS)).toBe(false);
  });
  it('is stale after 12 hours', () => {
    expect(isSessionStale(s, day, t0 + SESSION_MAX_AGE_MS + 1)).toBe(true);
  });
  it('is stale on another day even within 12 hours', () => {
    expect(isSessionStale(s, '2026-11-03', t0 + 60_000)).toBe(true);
  });
});
