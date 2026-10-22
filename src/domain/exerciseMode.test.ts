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

describe('chooseMode', () => {
  it('box 1: first showing is order, later showings are write', () => {
    expect(chooseMode({ item, progress: null, entryKind: 'new', showCount: 0 })).toBe('order');
    expect(chooseMode({ item, progress: progress(1, 1), entryKind: 'due', showCount: 1 })).toBe('write');
    expect(chooseMode({ item, progress: progress(1, 5), entryKind: 'due', showCount: 5 })).toBe('write');
  });

  it('box >= 2 with a commonMistake: every 3rd showing is fix, the rest write', () => {
    const modes = [1, 2, 3, 4, 5, 6].map((n) => chooseMode({ item, progress: progress(3), entryKind: 'due', showCount: n }));
    expect(modes).toEqual(['write', 'fix', 'write', 'write', 'fix', 'write']);
  });

  it('box >= 2 without a commonMistake is always write', () => {
    for (let n = 1; n < 8; n++) expect(chooseMode({ item: noMistake, progress: progress(2), entryKind: 'due', showCount: n })).toBe('write');
  });

  it('end-of-round repeats are order, whatever the box', () => {
    expect(chooseMode({ item, progress: progress(4, 3), entryKind: 'repeat', showCount: 3 })).toBe('order');
  });

  it('practice rotates write, fix, order', () => {
    const modes = [0, 1, 2, 3, 4, 5].map((n) => chooseMode({ item, progress: progress(3), entryKind: 'practice', showCount: n }));
    expect(modes).toEqual(['write', 'fix', 'order', 'write', 'fix', 'order']);
  });

  it('falls back to write when the item cannot do the mode', () => {
    expect(chooseMode({ item: oneWord, progress: null, entryKind: 'new', showCount: 0 })).toBe('write');
    expect(chooseMode({ item: oneWord, progress: null, entryKind: 'repeat', showCount: 0 })).toBe('write');
    expect(chooseMode({ item: noMistake, progress: null, entryKind: 'practice', showCount: 1 })).toBe('write');
  });

  it('is deterministic', () => {
    const input = { item, progress: progress(2), entryKind: 'due', showCount: 2 };
    expect(chooseMode(input)).toBe(chooseMode(input));
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
