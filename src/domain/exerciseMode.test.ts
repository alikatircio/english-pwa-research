import { describe, expect, it } from 'vitest';
import { answerTokens, chooseMode, shuffleTokens, showsBefore } from './exerciseMode.ts';
import type { Box, Item, Progress } from './types.ts';

const item: Item = {
  id: 'a',
  category: 'aux_to',
  targetChunk: 'send',
  clozeTemplate: "I'll ___ the report ___.",
  situationTr: 's',
  acceptedAnswers: ["I'll send the report today."],
  modelSentences: ["I'll send the report today."],
  commonMistake: 'I will to send the report today.',
  checklistTr: ['c'],
  noteTr: 'n',
  source: 'curated',
  verified: true,
  level: 1,
};
const noMistake: Item = { ...item, id: 'b' };
delete noMistake.commonMistake;
const oneWord: Item = { ...item, id: 'c', acceptedAnswers: ['Thanks'] };

const progress = (box: Box, shows?: number): Progress => ({
  itemId: 'a',
  box,
  dueOn: '2026-11-02',
  introducedOn: '2026-11-01',
  lastAnsweredOn: '2026-11-01',
  lastGrade: 'correct',
  updatedAt: 1,
  ...(shows === undefined ? {} : { shows }),
});

describe('chooseMode (decisions 36, 37)', () => {
  const pick = (o: { box?: Box | null; kind?: string; n: number; last?: boolean; it?: Item }) =>
    chooseMode({
      item: o.it ?? item,
      progress: o.box == null ? null : progress(o.box),
      entryKind: o.kind ?? 'due',
      showCount: o.n,
      isLast: o.last ?? false,
    });

  it('new cards and box 1-2 cards are write (order is practice-only)', () => {
    expect(pick({ box: null, kind: 'new', n: 0 })).toBe('write');
    for (const box of [1, 2] as const) for (let n = 0; n < 8; n++) expect(pick({ box, n })).toBe('write');
  });

  it('box >= 3 with a commonMistake: every 3rd showing is fix, the rest write', () => {
    const modes = [1, 2, 3, 4, 5, 6].map((n) => pick({ box: 3, n }));
    expect(modes).toEqual(['write', 'fix', 'write', 'write', 'fix', 'write']);
    expect(pick({ box: 7, n: 2 })).toBe('fix');
  });

  it('box >= 3 without a commonMistake is always write', () => {
    for (let n = 1; n < 8; n++) expect(pick({ box: 4, n, it: noMistake })).toBe('write');
  });

  it('never fix on the last card of a round', () => {
    expect(pick({ box: 4, n: 2, last: false })).toBe('fix');
    expect(pick({ box: 4, n: 2, last: true })).toBe('write');
  });

  it('in-round re-asks are write, whatever the box', () => {
    expect(pick({ box: 4, kind: 'repeat', n: 2 })).toBe('write');
  });

  it('practice rotates write, fix, order; fix needs box >= 3 and a non-last card', () => {
    const rot = (box: Box, last = false) => [0, 1, 2, 3, 4, 5].map((n) => pick({ box, kind: 'practice', n, last }));
    expect(rot(3)).toEqual(['write', 'fix', 'order', 'write', 'fix', 'order']);
    expect(rot(2)).toEqual(['write', 'write', 'order', 'write', 'write', 'order']);
    expect(pick({ box: 3, kind: 'practice', n: 1, last: true })).toBe('write');
  });

  it('falls back to write when the item cannot do the mode', () => {
    expect(pick({ box: 3, kind: 'practice', n: 2, it: oneWord })).toBe('write');
    expect(pick({ box: 3, kind: 'practice', n: 1, it: noMistake })).toBe('write');
  });

  it('is deterministic', () => {
    expect(pick({ box: 3, n: 2 })).toBe(pick({ box: 3, n: 2 }));
  });
});

describe('showsBefore', () => {
  it('new card 0, missing field 1, otherwise the counter', () => {
    expect(showsBefore(null)).toBe(0);
    expect(showsBefore(progress(2))).toBe(1);
    expect(showsBefore(progress(2, 7))).toBe(7);
  });
});

describe('shuffleTokens', () => {
  const answer = "I'll send the report today.";
  it('keeps punctuation attached and every word', () => {
    expect(answerTokens(answer)).toEqual(["I'll", 'send', 'the', 'report', 'today.']);
    expect([...shuffleTokens(answer, 'x')].sort()).toEqual([...answerTokens(answer)].sort());
  });
  it('is deterministic per seed', () => {
    expect(shuffleTokens(answer, 'seed-1')).toEqual(shuffleTokens(answer, 'seed-1'));
  });
  it('never returns the original order across many seeds, even for short answers', () => {
    for (const a of [answer, 'Could you check it?', 'a b', 'a a b', 'go home now now']) {
      const orig = answerTokens(a);
      for (let seed = 0; seed < 300; seed++) expect(shuffleTokens(a, seed)).not.toEqual(orig);
    }
  });
  it('different seeds give different orders', () => {
    const seen = new Set(Array.from({ length: 30 }, (_, i) => shuffleTokens(answer, i).join(' ')));
    expect(seen.size).toBeGreaterThan(5);
  });
  it('returns the words unchanged when fewer than 2 are distinct', () => {
    expect(shuffleTokens('Thanks', 1)).toEqual(['Thanks']);
    expect(shuffleTokens('no no', 1)).toEqual(['no', 'no']);
    expect(shuffleTokens('', 1)).toEqual([]);
  });
});
