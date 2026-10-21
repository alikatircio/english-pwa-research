import { describe, expect, it } from 'vitest';
import type { ContentBundle, Item, Progress } from '../domain/types.ts';
import { createCatalog, SLICE1_FIRST_IDS, temporaryOrder } from './catalog.ts';
import batchA from '../../content/drafts/batch-a.verified.json';
import batchB from '../../content/drafts/batch-b.verified.json';

const base: Item = {
  id: 'a', category: 'aux_to', level: 1, targetChunk: 't', clozeTemplate: '___', situationTr: 's',
  acceptedAnswers: ['I’ll go.', 'I will go'], modelSentences: ['I’ll go.'], checklistTr: ['c'], noteTr: 'n',
  source: 'curated', verified: true, verifiedNote: 'v',
};
const bundle = (items: Item[]): ContentBundle => ({ contentVersion: 'v1', generatedAt: '', items });
const prog = (itemId: string): Progress => ({ itemId, box: 1, dueOn: '2026-11-03', introducedOn: '2026-11-02', lastAnsweredOn: '2026-11-02', lastGrade: 'wrong', updatedAt: 0 });

describe('createCatalog', () => {
  it('keeps verified items only and precomputes normalised answers', () => {
    const c = createCatalog(bundle([base, { ...base, id: 'b', verified: false }]));
    expect(c.items.map((i) => i.id)).toEqual(['a']);
    expect(c.accepted.get('a')).toEqual(new Set(['i will go']));
  });
});

describe('temporaryOrder', () => {
  const ids = ['x', 'remind-someone-to', 'y', 'could-you-base-verb', 'z'];
  const c = createCatalog(bundle(ids.map((id) => ({ ...base, id }))));
  it('puts the Slice 1 ten first, then file order, skipping answered and flagged', () => {
    expect(temporaryOrder(c, new Map())).toEqual(['could-you-base-verb', 'remind-someone-to', 'x', 'y', 'z']);
    expect(temporaryOrder(c, new Map([['x', prog('x')], ['could-you-base-verb', prog('could-you-base-verb')]]), new Set(['z']))).toEqual(['remind-someone-to', 'y']);
  });
  it('the Slice 1 ten all exist and are verified in the real drafts', () => {
    const verified = new Set(([...batchA, ...batchB] as Item[]).filter((i) => i.verified).map((i) => i.id));
    expect(SLICE1_FIRST_IDS).toHaveLength(10);
    for (const id of SLICE1_FIRST_IDS) expect(verified.has(id), id).toBe(true);
  });
});
