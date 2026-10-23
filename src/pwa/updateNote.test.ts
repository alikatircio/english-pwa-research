import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildId, markUpdateApplied, shouldShowUpdatedNote, takeUpdateFlag } from './updateNote.ts';

afterEach(() => vi.unstubAllGlobals());

describe('shouldShowUpdatedNote', () => {
  const current = '1.3.0+abc1234';
  it('shows only after an applied update with a different, known previous build', () => {
    expect(shouldShowUpdatedNote({ flagged: true, lastSeen: '1.2.0+old', current })).toBe(true);
    expect(shouldShowUpdatedNote({ flagged: true, lastSeen: '1.3.0+other', current })).toBe(true);
  });
  it('stays hidden without the flag, on the same build, or on first run', () => {
    expect(shouldShowUpdatedNote({ flagged: false, lastSeen: '1.2.0+old', current })).toBe(false);
    expect(shouldShowUpdatedNote({ flagged: true, lastSeen: current, current })).toBe(false);
    expect(shouldShowUpdatedNote({ flagged: true, lastSeen: undefined, current })).toBe(false);
  });
});

describe('update flag', () => {
  it('is set once, peeked without consuming, then taken', () => {
    const store = new Map<string, string>();
    vi.stubGlobal('sessionStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
    expect(takeUpdateFlag()).toBe(false);
    markUpdateApplied();
    expect(takeUpdateFlag(true)).toBe(true);
    expect(takeUpdateFlag()).toBe(true);
    expect(takeUpdateFlag()).toBe(false);
  });
  it('survives blocked storage', () => {
    vi.stubGlobal('sessionStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    });
    expect(() => markUpdateApplied()).not.toThrow();
    expect(takeUpdateFlag()).toBe(false);
  });
});

it('buildId combines version and sha', () => {
  expect(buildId({ version: '1.3.0', date: 'x', sha: 'abc1234', contentVersion: 'c' })).toBe('1.3.0+abc1234');
});
