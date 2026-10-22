import { describe, expect, it } from 'vitest';
import type { ContentBundle, Item } from '../domain/types.ts';
import { createCatalog, newOrder } from './catalog.ts';

const base: Item = {
  id: 'a', category: 'aux_to', level: 1, targetChunk: 't', clozeTemplate: '___', situationTr: 's',
  acceptedAnswers: ['I’ll go.', 'I will go'], modelSentences: ['I’ll go.'], checklistTr: ['c'], noteTr: 'n',
  source: 'curated', verified: true, verifiedNote: 'v',
};
const bundle = (items: Item[]): ContentBundle => ({ contentVersion: 'v1', generatedAt: '', items });

describe('createCatalog', () => {
  it('keeps verified items only and precomputes normalised answers', () => {
    const c = createCatalog(bundle([base, { ...base, id: 'b', verified: false }]));
    expect(c.items.map((i) => i.id)).toEqual(['a']);
    expect(c.accepted.get('a')).toEqual(new Set(['i will go']));
  });
});

describe('newOrder (07 §3.6)', () => {
  it('puts notebook (user-error) items first, then level ascending, then catalog order', () => {
    const c = createCatalog(
      bundle([
        { ...base, id: 'l2', level: 2 },
        { ...base, id: 'l1a', level: 1 },
        { ...base, id: 'mine', level: 3, source: 'user-error' },
        { ...base, id: 'l1b', level: 1 },
        { ...base, id: 'l3', level: 3 },
      ]),
    );
    expect(newOrder(c)).toEqual(['mine', 'l1a', 'l1b', 'l2', 'l3']);
  });
});
