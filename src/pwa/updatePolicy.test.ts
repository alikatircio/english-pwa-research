import { describe, expect, it } from 'vitest';
import { mayReloadNow, shouldCheckForUpdate, UPDATE_CHECK_INTERVAL_MS, type ReloadConditions } from './updatePolicy.ts';

const safe: ReloadConditions = { updateReady: true, screen: 'home', hasSession: false, visible: true };

describe('mayReloadNow', () => {
  it('reloads on Home with an update, no round and a visible page', () => {
    expect(mayReloadNow(safe)).toBe(true);
  });

  it('never reloads without a waiting update', () => {
    expect(mayReloadNow({ ...safe, updateReady: false })).toBe(false);
  });

  it.each(['card', 'done', 'notebook', 'settings', 'firstRun'])('never reloads on the %s screen', (screen) => {
    expect(mayReloadNow({ ...safe, screen })).toBe(false);
  });

  it('never reloads on the card screen even when everything else is safe', () => {
    expect(mayReloadNow({ updateReady: true, screen: 'card', hasSession: true, visible: true })).toBe(false);
  });

  it('does not reload on Home while a round is in progress', () => {
    expect(mayReloadNow({ ...safe, hasSession: true })).toBe(false);
  });

  it('does not reload while the page is hidden', () => {
    expect(mayReloadNow({ ...safe, visible: false })).toBe(false);
  });
});

describe('shouldCheckForUpdate', () => {
  const t0 = 1_700_000_000_000;

  it('checks the first time', () => {
    expect(shouldCheckForUpdate(undefined, t0)).toBe(true);
  });

  it('waits a full interval between checks', () => {
    expect(shouldCheckForUpdate(t0, t0 + UPDATE_CHECK_INTERVAL_MS - 1)).toBe(false);
    expect(shouldCheckForUpdate(t0, t0 + UPDATE_CHECK_INTERVAL_MS)).toBe(true);
  });

  it('checks when the clock moved backwards', () => {
    expect(shouldCheckForUpdate(t0, t0 - 1)).toBe(true);
  });

  it('honours a custom interval', () => {
    expect(shouldCheckForUpdate(t0, t0 + 10, 10)).toBe(true);
    expect(shouldCheckForUpdate(t0, t0 + 9, 10)).toBe(false);
  });
});
