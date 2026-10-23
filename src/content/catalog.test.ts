import { describe, expect, it } from 'vitest';
import type { ContentBundle, Item } from '../domain/types.ts';
import { cachedOrder } from '../app/round.ts';
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

  describe('priority set (Ö6)', () => {
    const c = createCatalog(
      bundle([
        { ...base, id: 'l2', level: 2 },
        { ...base, id: 'l1a', level: 1 },
        { ...base, id: 'mine', level: 3, source: 'user-error' },
        { ...base, id: 'l1b', level: 1 },
        { ...base, id: 'l3', level: 3 },
        { ...base, id: 'l3b', level: 3 },
      ]),
    );
    it('no or empty set gives the same order', () => {
      expect(newOrder(c, new Set())).toEqual(newOrder(c));
      expect(newOrder(c, undefined)).toEqual(['mine', 'l1a', 'l1b', 'l2', 'l3', 'l3b']);
    });
    it('notebook first, then priority in level order, then the rest', () => {
      expect(newOrder(c, new Set(['l3b', 'l2', 'mine']))).toEqual(['mine', 'l2', 'l3b', 'l1a', 'l1b', 'l3']);
    });
    it('cache returns the order for the current set', () => {
      expect(cachedOrder(c)).toEqual(newOrder(c));
      expect(cachedOrder(c, new Set(['l3']))).toEqual(['mine', 'l3', 'l1a', 'l1b', 'l2', 'l3b']);
      expect(cachedOrder(c, new Set(['l2']))).toEqual(['mine', 'l2', 'l1a', 'l1b', 'l3', 'l3b']);
      expect(cachedOrder(c, new Set())).toEqual(newOrder(c));
      expect(cachedOrder(c, new Set(['l3']))).toEqual(['mine', 'l3', 'l1a', 'l1b', 'l2', 'l3b']);
    });
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

describe('imported notebook items come first (T3.5, decision 3)', () => {
  const mine = (id: string, level: 1 | 2 | 3): Item => ({ ...base, id, source: 'user-error', verifiedNote: 'user-import', level });
  it('newOrder puts imported user-error items before curated ones, even at a higher level', () => {
    const c = createCatalog(bundle([{ ...base, id: 'x', level: 2 }, { ...base, id: 'y', level: 1 }]), [mine('n1', 3)]);
    expect(newOrder(c)).toEqual(['n1', 'y', 'x']);
    expect(newOrder(withImported(c, [mine('n2', 1)]))).toEqual(['n2', 'n1', 'y', 'x']);
  });
});
