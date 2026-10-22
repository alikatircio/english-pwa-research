import { describe, expect, it } from 'vitest';
import type { ContentBundle, Item } from '../domain/types.ts';
import { createCatalog, newOrder, withImported } from './catalog.ts';

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

describe('imported items', () => {
  const imported = (id: string, extra: Partial<Item> = {}): Item => ({ ...base, id, source: 'user-error', verifiedNote: 'user-import', ...extra });

  it('are added after bundled content; an id that is bundled content never shadows it', () => {
    const c = createCatalog(bundle([base]), [imported('n1'), imported('a', { targetChunk: 'evil' })]);
    expect(c.items.map((i) => i.id)).toEqual(['a', 'n1']);
    expect(c.byId.get('a')?.targetChunk).toBe('t');
    expect(c.builtinIds).toEqual(new Set(['a']));
    expect(c.imported.map((i) => i.id)).toEqual(['n1']);
  });

  it('withImported adds new items and replaces a re-imported id', () => {
    const c = withImported(createCatalog(bundle([base]), [imported('n1', { targetChunk: 'old' })]), [imported('n1', { targetChunk: 'new' }), imported('n2')]);
    expect(c.items.map((i) => i.id)).toEqual(['a', 'n1', 'n2']);
    expect(c.byId.get('n1')?.targetChunk).toBe('new');
    expect(c.accepted.get('n2')).toEqual(new Set(['i will go']));
  });
});
