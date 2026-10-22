import { describe, expect, it } from 'vitest';
import { answerTokens, chooseMode, contextAnswer, contextCard, gradeContext, shuffleTokens, showsBefore } from './exerciseMode.ts';
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

const withBlanks: Item = {
  ...item,
  id: 'd',
  modelSentences: ["I'll send the report today.", "I'll send you the report today.", "We'll send them the report today."],
  modelBlanks: ["I'll ___ you the ___ today.", null],
};

describe('context mode (decision 42)', () => {
  const pick = (o: { box: Box | null; n: number; kind?: string; last?: boolean; it?: Item }) =>
    chooseMode({ item: o.it ?? withBlanks, progress: o.box === null ? null : progress(o.box), entryKind: o.kind ?? 'due', showCount: o.n, isLast: o.last ?? false });

  it('box >= 2 cycles write, context, write, fix', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7].map((n) => pick({ box: 3, n }))).toEqual(['write', 'context', 'write', 'fix', 'write', 'context', 'write', 'fix']);
    expect([0, 1, 2, 3].map((n) => pick({ box: 2, n }))).toEqual(['write', 'context', 'write', 'write']); // fix needs box >= 3
  });

  it('box 1, new cards and re-asks stay write', () => {
    for (let n = 0; n < 4; n++) expect(pick({ box: 1, n })).toBe('write');
    expect(pick({ box: null, n: 1, kind: 'new' })).toBe('write');
    expect(pick({ box: 4, n: 1, kind: 'repeat' })).toBe('write');
  });

  it('fix keeps its conditions: not on the last card; context has no such limit', () => {
    expect(pick({ box: 4, n: 3, last: true })).toBe('write');
    expect(pick({ box: 4, n: 1, last: true })).toBe('context');
  });

  it('an item with only null blanks, or no blanks, never gets context', () => {
    const allNull: Item = { ...withBlanks, modelBlanks: [null, null] };
    for (let n = 0; n < 8; n++) {
      expect(pick({ box: 3, n, it: allNull })).not.toBe('context');
      expect(pick({ box: 3, n, it: item })).not.toBe('context');
    }
  });

  it('contextCard picks a usable entry by showCount and skips nulls and inconsistent entries', () => {
    expect(contextCard(withBlanks, 1)).toEqual({ blanked: "I'll ___ you the ___ today.", original: "I'll send you the report today.", answers: ['send', 'report'] });
    expect(contextCard(withBlanks, 5)).toEqual(contextCard(withBlanks, 1));
    const two: Item = { ...withBlanks, modelBlanks: ["I'll ___ you the ___ today.", 'We\'ll ___ them the report ___.'] };
    expect(contextCard(two, 1)?.original).toBe("I'll send you the report today.");
    expect(contextCard(two, 5)?.answers).toEqual(['send', 'today']);
    const broken: Item = { ...withBlanks, modelBlanks: ['Totally ___ different.', null] };
    expect(contextCard(broken, 0)).toBeNull();
  });

  const daily = { sentence: 'I need to send mom a photo.', blank: 'I need to ___ mom a ___.' };
  const ctxOf = (it: Item, n: number) => contextCard(it, n)?.original;

  it('dailyContext alone makes an item eligible for context mode', () => {
    const only: Item = { ...item, id: 'e', dailyContext: daily };
    expect(pick({ box: 3, n: 1, it: only })).toBe('context');
    expect(contextCard(only, 1)).toEqual({ blanked: daily.blank, original: daily.sentence, answers: ['send', 'photo'], daily: true });
    expect(contextCard(only, 5)?.original).toBe(daily.sentence);
  });

  it('work and daily alternate across context showings (showCount 1, 5, 9, ...)', () => {
    const both: Item = { ...withBlanks, dailyContext: daily };
    const seq = [1, 5, 9, 13].map((n) => contextCard(both, n)?.daily === true);
    expect(seq).toEqual([false, true, false, true]);
    expect(ctxOf(both, 1)).toBe("I'll send you the report today.");
    expect(ctxOf(both, 5)).toBe(daily.sentence);
  });

  it('with several work entries the work slots cycle through them, daily in between', () => {
    const two: Item = { ...withBlanks, modelBlanks: ["I'll ___ you the ___ today.", 'We\'ll ___ them the report ___.'], dailyContext: daily };
    expect([1, 5, 9, 13, 17, 21].map((n) => ctxOf(two, n))).toEqual([
      "I'll send you the report today.",
      daily.sentence,
      "We'll send them the report today.",
      daily.sentence,
      "I'll send you the report today.",
      daily.sentence,
    ]);
  });

  it('is deterministic and ignores an inconsistent dailyContext', () => {
    const both: Item = { ...withBlanks, dailyContext: daily };
    expect(contextCard(both, 5)).toEqual(contextCard(both, 5));
    const bad: Item = { ...withBlanks, dailyContext: { sentence: 'Something else.', blank: 'Totally ___ different.' } };
    expect(ctxOf(bad, 5)).toBe("I'll send you the report today.");
    expect(contextCard({ ...item, dailyContext: bad.dailyContext }, 1)).toBeNull();
  });

  it('gradeContext compares every blank after normalisation', () => {
    expect(gradeContext(['send', 'report'], ['send', 'report'])).toBe(true);
    expect(gradeContext([' Send ', 'REPORT.'], ['send', 'report'])).toBe(true);
    expect(gradeContext(['send', 'mail'], ['send', 'report'])).toBe(false);
    expect(gradeContext(['send'], ['send', 'report'])).toBe(false);
  });

  it('contextAnswer rebuilds the sentence the user typed, empty when nothing was typed', () => {
    const card = contextCard(withBlanks, 0);
    if (!card) throw new Error('no card');
    expect(contextAnswer(card, ['send ', 'mail'])).toBe("I'll send you the mail today.");
    expect(contextAnswer(card, ['', ' '])).toBe('');
  });
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

  it('box >= 3 with a commonMistake but no blanks: every 4th showing is fix (rotation slot 3), the rest write', () => {
    const modes = [0, 1, 2, 3, 4, 5, 6, 7].map((n) => pick({ box: 3, n }));
    expect(modes).toEqual(['write', 'write', 'write', 'fix', 'write', 'write', 'write', 'fix']);
    expect(pick({ box: 7, n: 3 })).toBe('fix');
  });

  it('box >= 3 without a commonMistake is always write', () => {
    for (let n = 1; n < 8; n++) expect(pick({ box: 4, n, it: noMistake })).toBe('write');
  });

  it('never fix on the last card of a round', () => {
    expect(pick({ box: 4, n: 3, last: false })).toBe('fix');
    expect(pick({ box: 4, n: 3, last: true })).toBe('write');
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

  it('practice never uses context', () => {
    for (let n = 0; n < 8; n++) expect(pick({ box: 3, kind: 'practice', n, it: withBlanks })).not.toBe('context');
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
