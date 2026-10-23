import { describe, expect, it, vi } from 'vitest';
import { createOverlayController } from './overlay.tsx';

const topic = { kind: 'topic', topicId: 't1' } as const;

describe('overlay controller', () => {
  it('open sets and close clears the overlay, notifying subscribers', () => {
    const c = createOverlayController(() => null);
    const listener = vi.fn();
    c.subscribe(listener);
    expect(c.get()).toBeUndefined();
    c.open(topic);
    expect(c.get()).toEqual(topic);
    c.close();
    expect(c.get()).toBeUndefined();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('close restores focus to the opener only if still connected', () => {
    const opener = { focus: vi.fn(), isConnected: true };
    const c = createOverlayController(() => opener);
    c.open(topic);
    c.close();
    expect(opener.focus).toHaveBeenCalledTimes(1);

    const gone = { focus: vi.fn(), isConnected: false };
    const c2 = createOverlayController(() => gone);
    c2.open(topic);
    c2.close();
    expect(gone.focus).not.toHaveBeenCalled();
  });

  it('keeps the first opener when opened twice', () => {
    const first = { focus: vi.fn(), isConnected: true };
    const second = { focus: vi.fn(), isConnected: true };
    const targets = [first, second];
    const c = createOverlayController(() => targets.shift() ?? null);
    c.open(topic);
    c.open({ kind: 'topic', topicId: 't2' });
    c.close();
    expect(first.focus).toHaveBeenCalledTimes(1);
    expect(second.focus).not.toHaveBeenCalled();
  });
});
