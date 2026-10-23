import { describe, expect, it } from 'vitest';
import fixture from '../../content/fixtures/e2e-items.json';
import { createCatalog } from '../content/catalog.ts';
import { fixedClock } from '../domain/clock.ts';
import type { Message } from '../domain/extrasSchema.ts';
import { emptyCounter } from '../domain/session.ts';
import type { Box, ContentBundle, Progress } from '../domain/types.ts';
import { metaFromRecords } from './meta.ts';
import { freshRound, nextCard, onShowableCard, practiceRound } from './round.ts';

const clock = fixedClock(new Date(2026, 10, 2, 8).getTime());
const catalog = createCatalog(fixture as ContentBundle, []);
const ids = catalog.byId.keys();
const [a, b, c] = [...ids];
const prog = (itemId: string, box: Box, lastPracticedAt?: number): Progress => ({
  itemId, box, dueOn: '2026-11-30', introducedOn: '2026-10-01', lastAnsweredOn: '2026-10-02', lastGrade: 'correct', updatedAt: 1, ...(lastPracticedAt ? { lastPracticedAt } : {}),
});
const msg = (id: string, ...blanks: string[]): Message => ({
  id, channel: 'teams', contextTr: 'c', text: 't', blanked: 'b', blanks: blanks.map((itemId) => ({ itemId })), verified: true, verifiedNote: 'n',
});
const base = {
  catalog, flags: new Set<string>(), meta: metaFromRecords([]), newPriority: undefined,
  progress: new Map([a, b, c].map((id, i) => [id as string, prog(id as string, 4 + (i % 2) as Box)])),
};
const counter = { ...emptyCounter(clock.today()), newIntroduced: 99 };

describe('practiceRound with a message', () => {
  const plain = practiceRound({ ...base, messages: undefined, messageLastAt: undefined }, counter, clock);
  const messages = [msg('msg-1', a as string, b as string), msg('msg-2', c as string)];

  it('is identical to today without an eligible message', () => {
    expect(plain?.queue.length).toBe(3);
    const none = practiceRound({ ...base, messages: [msg('msg-x', 'unknown-item')], messageLastAt: undefined }, counter, clock);
    expect(none?.queue).toEqual(plain?.queue);
  });

  it('ends with exactly one message step, the least recently practised', () => {
    const s = practiceRound({ ...base, messages, messageLastAt: new Map([['msg-1', 5]]) }, counter, clock);
    expect(s?.queue.slice(0, -1)).toEqual(plain?.queue);
    expect(s?.queue.at(-1)).toEqual({ itemId: 'msg-2', kind: 'message' });
    expect(s?.queue.filter((e) => e.kind === 'message')).toHaveLength(1);
  });

  it('drops a message that became ineligible when the round moves on', () => {
    const s = practiceRound({ ...base, messages, messageLastAt: undefined }, counter, clock);
    if (!s) throw new Error('no round');
    const last = { ...s, cursor: s.queue.length - 1 };
    expect(onShowableCard(last, { ...base, messages })).toBe(last);
    expect(onShowableCard(last, { ...base, flags: new Set([a as string]), messages })).toBe('round-end');
    expect(nextCard({ ...s, cursor: s.queue.length - 2 }, { ...base, messages })).not.toBe('round-end');
  });

  it('never adds a message to a regular round', () => {
    const fresh = freshRound({ ...base, progress: new Map(), messages, messageLastAt: undefined }, emptyCounter(clock.today()), clock);
    expect(fresh?.queue.some((e) => e.kind === 'message')).toBe(false);
  });
});
