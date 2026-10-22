// Notebook capture rules (03 H3.1; 07 §3.2). Pure: the caller injects id and time.
import type { NotebookEntry } from './types.ts';

/** Where the sheet was opened: mid-card adds the card's situation as context. */
export interface NotebookContext {
  contextTr: string;
  contextItemId: string;
}

/**
 * Key for "is this already in the notebook?" (H3.1): Turkish-aware lower case,
 * smart quotes folded, outer punctuation and extra whitespace ignored.
 * Only used for the duplicate warning, never to block a save.
 */
export function notebookKey(text: string): string {
  return text
    .normalize('NFC')
    .replace(/[’‘‛ʼ′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .toLocaleLowerCase('tr')
    .replace(/\s+/g, ' ')
    .replace(/^[\s"'.,;:!?…-]+|[\s"'.,;:!?…-]+$/g, '');
}

export function isDuplicateEntry(text: string, entries: readonly NotebookEntry[]): boolean {
  const key = notebookKey(text);
  return key !== '' && entries.some((e) => notebookKey(e.textTr) === key);
}

/** Trimmed text; '' means the save button stays disabled. */
export function cleanNotebookText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function createNotebookEntry(
  text: string,
  context: NotebookContext | undefined,
  id: string,
  now: number,
): NotebookEntry {
  const textTr = cleanNotebookText(text);
  if (textTr === '') throw new Error('notebook entry text is empty');
  return {
    id,
    textTr,
    ...(context ? { contextTr: context.contextTr, contextItemId: context.contextItemId } : {}),
    createdAt: now,
    status: 'open',
  };
}
