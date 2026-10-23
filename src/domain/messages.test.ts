import { describe, expect, it } from 'vitest';
import type { Message } from './extrasSchema.ts';
import { isMessageEligible, pickMessage } from './messages.ts';
import type { Box, Item, Progress } from './types.ts';

const msg = (id: string, ...blanks: string[]): Message => ({
  id, channel: 'teams', contextTr: 'c', text: 't', blanked: 'b', blanks: blanks.map((itemId) => ({ itemId })), verified: true, verifiedNote: 'n',
});
const prog = (itemId: string, box: Box): Progress => ({ itemId, box, dueOn: '2026-11-09', introducedOn: '2026-11-01', lastAnsweredOn: '2026-11-02', lastGrade: 'correct', updatedAt: 1 });
const pools = (boxes: Record<string, Box>, flagged: string[] = []) => ({
  items: new Map(Object.keys(boxes).map((id) => [id, {} as Item])),
  progress: new Map(Object.entries(boxes).map(([id, b]) => [id, prog(id, b)])),
  flaggedIds: new Set(flagged),
});

describe('isMessageEligible', () => {
  it('needs every blank at box >= 4', () => {
    expect(isMessageEligible(msg('msg-a', 'x', 'y'), pools({ x: 4, y: 5 }))).toBe(true);
    expect(isMessageEligible(msg('msg-a', 'x', 'y'), pools({ x: 4, y: 3 }))).toBe(false);
  });
  it('excludes a message with a flagged (suspended), unseen or unknown blank item', () => {
    expect(isMessageEligible(msg('msg-a', 'x', 'y'), pools({ x: 4, y: 5 }, ['y']))).toBe(false);
    expect(isMessageEligible(msg('msg-a', 'x', 'z'), pools({ x: 4 }))).toBe(false);
  });
});

describe('pickMessage', () => {
  const p = pools({ x: 4, y: 4, w: 2 });
  const all = [msg('msg-low', 'w'), msg('msg-1', 'x'), msg('msg-2', 'y')];
  it('takes the first eligible message in file order when none was practised', () => {
    expect(pickMessage(all, p)?.id).toBe('msg-1');
  });
  it('prefers the least recently practised, never practised first', () => {
    expect(pickMessage(all, p, new Map([['msg-1', 50]]))?.id).toBe('msg-2');
    expect(pickMessage(all, p, new Map([['msg-1', 50], ['msg-2', 10]]))?.id).toBe('msg-2');
  });
  it('is undefined when nothing is eligible', () => {
    expect(pickMessage([msg('msg-low', 'w')], p)).toBeUndefined();
  });
});
