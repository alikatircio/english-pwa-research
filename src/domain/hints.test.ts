import { describe, expect, it } from 'vitest';
import batchA from '../../content/drafts/batch-a.verified.json';
import batchB from '../../content/drafts/batch-b.verified.json';
import { hintStageFor, initialsFor, renderHint } from './hints.ts';
import { ItemSchema } from './itemSchema.ts';
import type { Box, Item, Progress } from './types.ts';

const item: Item = {
  id: 'assign-to',
  category: 'preposition',
  level: 1,
  targetChunk: 'assign something to someone',
  clozeTemplate: 'Could you ___ QA-123 ___ Ayşe?',
  situationTr: 'Ticket’ı Ayşe’ye atamasını istiyorsun.',
  acceptedAnswers: ['Could you assign QA-123 to Ayşe?'],
  modelSentences: ['Could you assign QA-123 to Ayşe?'],
  checklistTr: ['to kullandın mı?'],
  noteTr: 'Not.',
  source: 'curated',
  verified: true,
};

const progress = (box: Box): Progress => ({
  itemId: 'x',
  box,
  dueOn: '2026-11-02',
  introducedOn: '2026-11-01',
  lastAnsweredOn: '2026-11-01',
  lastGrade: 'correct',
  updatedAt: 0,
});

describe('hintStageFor', () => {
  it('new card (no progress) is stage 1', () => {
    expect(hintStageFor(null)).toBe(1);
  });
  it.each([
    [1, 1],
    [2, 2],
    [3, 3],
    [4, 3],
    [5, 3],
  ] as const)('box %i → stage %i', (box, stage) => {
    expect(hintStageFor(progress(box))).toBe(stage);
  });
});

describe('renderHint', () => {
  it('stage 1 returns the cloze unchanged', () => {
    expect(renderHint(item, 1)).toEqual({ kind: 'cloze', text: 'Could you ___ QA-123 ___ Ayşe?' });
  });
  it('stage 2 returns the initials of each blanked word, two spaces apart', () => {
    expect(renderHint(item, 2)).toEqual({ kind: 'initials', text: 'a…  t…' });
  });
  it('stage 3 returns no hint', () => {
    expect(renderHint(item, 3)).toEqual({ kind: 'none' });
  });
  it('stage 2 throws when the item has no accepted answer', () => {
    expect(() => renderHint({ ...item, acceptedAnswers: [] }, 2)).toThrow(/no accepted answer/);
  });
});

describe('initialsFor', () => {
  it('drops punctuation attached to the blank token (___?)', () => {
    expect(initialsFor('Can you see the ___?', 'Can you see the data?')).toBe('d…');
  });
  it('skips leading punctuation of the canonical word', () => {
    expect(initialsFor('He said ___ twice.', 'He said "fine" twice.')).toBe('f…');
  });
  it('keeps the case of an apostrophe word (I\'ll → I…)', () => {
    expect(initialsFor('___ send it today.', "I'll send it today.")).toBe('I…');
  });
  it('uses the whole hyphenated word once (heads-up: → h…)', () => {
    expect(initialsFor('Just a ___: staging will be down at 5.', 'Just a heads-up: staging will be down at 5.')).toBe(
      'h…',
    );
  });
  it('lists consecutive blanks in order', () => {
    expect(initialsFor('Please keep me ___ ___ ___.', 'Please keep me in the loop.')).toBe('i…  t…  l…');
  });
  it('ignores extra whitespace when aligning tokens', () => {
    expect(initialsFor('  I need ___   ___ it. ', 'I need  to check it.')).toBe('t…  c…');
  });
  it('throws when token counts differ', () => {
    expect(() => initialsFor('Could you ___ the logs?', 'Could you check all the logs?')).toThrow(/tokens/);
  });
  it('throws when the cloze has no blank', () => {
    expect(() => initialsFor('Could you check the logs?', 'Could you check the logs?')).toThrow(/no ___ blank/);
  });
  it('throws when the canonical word under a blank has no letter', () => {
    expect(() => initialsFor('Wait ___', 'Wait …')).toThrow(/no letter/);
  });
});

describe('drafts', () => {
  const drafts: Item[] = [...batchA, ...batchB].map((raw) => ItemSchema.parse(raw));

  it('every verified draft item renders a non-empty stage 2 hint', () => {
    expect(drafts.length).toBeGreaterThan(0);
    for (const d of drafts) {
      const hint = renderHint(d, 2);
      expect(hint.kind, d.id).toBe('initials');
      if (hint.kind === 'initials') expect(hint.text, d.id).toMatch(/^[\p{L}\p{N}]…( {2}[\p{L}\p{N}]…)*$/u);
    }
  });
});
