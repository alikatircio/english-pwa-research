import { describe, expect, it } from 'vitest';
import { NotebookEntrySchema } from './backup.ts';
import { cleanNotebookText, createNotebookEntry, isDuplicateEntry, notebookKey } from './notebook.ts';
import type { NotebookEntry } from './types.ts';

const entry = (textTr: string): NotebookEntry => ({ id: textTr, textTr, createdAt: 1, status: 'open' });

describe('notebookKey', () => {
  it('ignores case (Turkish İ/I), outer punctuation and extra spaces', () => {
    expect(notebookKey('  Sorunu   ekibe YÜKSELTMEK. ')).toBe('sorunu ekibe yükseltmek');
    expect(notebookKey('İSTEK')).toBe('istek');
    expect(notebookKey('IŞIK')).toBe('ışık');
    expect(notebookKey('“bir şey”?')).toBe('bir şey');
  });

  it('keeps inner punctuation and apostrophes', () => {
    expect(notebookKey("Jira'ya kaydı aç")).toBe("jira'ya kaydı aç");
    expect(notebookKey('Jira’ya kaydı aç')).toBe("jira'ya kaydı aç");
  });
});

describe('isDuplicateEntry', () => {
  const entries = [entry('sorunu ekibe yükseltmek')];
  it('finds the same text after normalisation', () => {
    expect(isDuplicateEntry('Sorunu ekibe yükseltmek!', entries)).toBe(true);
  });
  it('different text is not a duplicate', () => {
    expect(isDuplicateEntry('sorunu ekibe bildirmek', entries)).toBe(false);
  });
  it('empty text is never a duplicate', () => {
    expect(isDuplicateEntry('  ', [entry('')])).toBe(false);
  });
  it('converted entries count too', () => {
    expect(isDuplicateEntry('x', [{ ...entry('x'), status: 'converted' }])).toBe(true);
  });
});

describe('createNotebookEntry', () => {
  it('builds an open entry without context (Home)', () => {
    const e = createNotebookEntry('  sorunu  ekibe yükseltmek ', undefined, 'id-1', 42);
    expect(e).toEqual({ id: 'id-1', textTr: 'sorunu ekibe yükseltmek', createdAt: 42, status: 'open' });
    expect(NotebookEntrySchema.safeParse(e).success).toBe(true);
  });

  it('adds the card situation as context mid-card', () => {
    const e = createNotebookEntry('hatırlatmak', { contextTr: '[Teams] Mert’e yaz', contextItemId: 'remind' }, 'id-2', 7);
    expect(e.contextTr).toBe('[Teams] Mert’e yaz');
    expect(e.contextItemId).toBe('remind');
    expect(NotebookEntrySchema.safeParse(e).success).toBe(true);
  });

  it('refuses empty text', () => {
    expect(() => createNotebookEntry(' \n ', undefined, 'x', 1)).toThrow();
    expect(cleanNotebookText(' a \n b ')).toBe('a b');
  });
});
