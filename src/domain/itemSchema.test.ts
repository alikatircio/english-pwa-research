import { describe, expect, it } from 'vitest';
import batchA from '../../content/drafts/batch-a.verified.json';
import batchB from '../../content/drafts/batch-b.verified.json';
import { ItemSchema } from './itemSchema.ts';

const drafts: unknown[] = [...batchA, ...batchB];

const valid = {
  id: 'could-you-base-verb',
  category: 'aux_to',
  level: 1,
  targetChunk: 'can / could + base verb',
  clozeTemplate: 'Could you ___ the logs?',
  situationTr: 'Mert’e yazıyorsun.',
  acceptedAnswers: ['Could you check the logs?'],
  modelSentences: ['Could you check the logs?'],
  checklistTr: ['to koymadın, değil mi?'],
  noteTr: 'Not.',
  source: 'curated',
  verified: true,
  verifiedNote: 'ok',
};

describe('ItemSchema', () => {
  it('accepts category grammar', () => {
    expect(ItemSchema.safeParse({ ...valid, category: 'grammar' }).success).toBe(true);
  });

  it('accepts every draft item (68)', () => {
    expect(drafts).toHaveLength(68);
    for (const raw of drafts) {
      const r = ItemSchema.safeParse(raw);
      expect(r.success, JSON.stringify(r.error?.issues)).toBe(true);
    }
  });
  it('accepts modelBlanks with strings and nulls, and omits it by default', () => {
    expect(ItemSchema.safeParse({ ...valid, modelBlanks: ['Could you ___ the logs?', null] }).success).toBe(true);
    expect(ItemSchema.parse(valid).modelBlanks).toBeUndefined();
  });
  it.each([
    ['blank entry text', ['  ']],
    ['non-string entry', [3]],
    ['non-array', 'x'],
  ])('rejects modelBlanks with %s', (_n, modelBlanks) => {
    expect(ItemSchema.safeParse({ ...valid, modelBlanks }).success).toBe(false);
  });
  it('accepts a strict dailyContext and omits it by default', () => {
    expect(ItemSchema.safeParse({ ...valid, dailyContext: { sentence: 'I need to buy milk.', blank: 'I need ___ buy milk.' } }).success).toBe(true);
    expect(ItemSchema.parse(valid).dailyContext).toBeUndefined();
  });
  it.each([
    ['an extra key', { sentence: 'a b', blank: '___ b', extra: 1 }],
    ['a missing blank', { sentence: 'a b' }],
    ['blank text', { sentence: ' ', blank: '___' }],
    ['null', null],
  ])('rejects dailyContext with %s', (_n, dailyContext) => {
    expect(ItemSchema.safeParse({ ...valid, dailyContext }).success).toBe(false);
  });
  it('accepts a minimal valid item', () => {
    expect(ItemSchema.safeParse(valid).success).toBe(true);
  });
  it.each([
    ['non-kebab id', { ...valid, id: 'Could_You' }],
    ['unknown category', { ...valid, category: 'idiom' }],
    ['level 4', { ...valid, level: 4 }],
    ['empty acceptedAnswers', { ...valid, acceptedAnswers: [] }],
    ['4 checklist items', { ...valid, checklistTr: ['a', 'b', 'c', 'd'] }],
    ['unknown key (typo)', { ...valid, acceptedAnswer: ['x'] }],
    ['blank text', { ...valid, noteTr: '   ' }],
  ])('rejects %s', (_name, input) => {
    expect(ItemSchema.safeParse(input).success).toBe(false);
  });
});
