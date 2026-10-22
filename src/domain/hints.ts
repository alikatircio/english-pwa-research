// Hints (07 §3.5; decisions 18, 23, 35). Pure. Stage 1 = cloze, 2 = initials of the chunk, 3 = none.
import type { HintStage, Item } from './types.ts';

export const BLANK = '___';
/** Separator between initials: two spaces, so "a…  t…" reads as separate words. */
const INITIALS_SEPARATOR = '  ';
const ELLIPSIS = '…';
const FIRST_WORD_CHAR = /[\p{L}\p{N}]/u;

export type Hint = { kind: 'cloze'; text: string } | { kind: 'initials'; text: string } | { kind: 'none' };

/**
 * Decision 23: stage 2 is derived from the cloze blanks, no extra schema field.
 * Cloze and canonical answer are split on whitespace and must line up token by
 * token (content check C5 guarantees this for shipped items). For every cloze
 * token containing a blank, the first letter of the canonical word at that
 * position is shown (leading punctuation skipped, case kept), followed by "…".
 */
export function initialsFor(clozeTemplate: string, canonical: string): string {
  const clozeTokens = clozeTemplate.trim().split(/\s+/);
  const answerTokens = canonical.trim().split(/\s+/);
  if (clozeTokens.length !== answerTokens.length) {
    throw new Error(
      `Cloze has ${clozeTokens.length} tokens but the canonical answer has ${answerTokens.length}: "${clozeTemplate}" / "${canonical}"`,
    );
  }
  const initials: string[] = [];
  clozeTokens.forEach((token, i) => {
    if (!token.includes(BLANK)) return;
    const word = answerTokens[i] ?? '';
    const first = FIRST_WORD_CHAR.exec(word)?.[0];
    if (first === undefined) throw new Error(`Canonical token ${i + 1} ("${word}") has no letter or digit for a hint`);
    initials.push(first + ELLIPSIS);
  });
  if (initials.length === 0) throw new Error(`Cloze has no ${BLANK} blank: "${clozeTemplate}"`);
  return initials.join(INITIALS_SEPARATOR);
}

export interface ChunkToken {
  text: string;
  /** The word sits under a cloze blank: it belongs to the chunk. */
  hit: boolean;
}

/**
 * Decision 33: the model sentence's words, with the chunk part (the words under
 * the cloze blanks) flagged. A sentence that does not line up with the cloze
 * (imported items) comes back without any highlight.
 */
export function chunkTokens(clozeTemplate: string, sentence: string): ChunkToken[] {
  const words = sentence.trim().split(/\s+/);
  const cloze = clozeTemplate.trim().split(/\s+/);
  const aligned = words.length === cloze.length;
  return words.map((text, i) => ({ text, hit: aligned && (cloze[i] ?? '').includes(BLANK) }));
}

/** Stage 1: cloze as written. Stage 2: initials of the blanked words. Stage 3: no hint (situation only). */
export function renderHint(item: Item, stage: HintStage): Hint {
  switch (stage) {
    case 1:
      return { kind: 'cloze', text: item.clozeTemplate };
    case 2: {
      const canonical = item.acceptedAnswers[0];
      if (canonical === undefined) throw new Error(`Item ${item.id} has no accepted answer`);
      return { kind: 'initials', text: initialsFor(item.clozeTemplate, canonical) };
    }
    case 3:
      return { kind: 'none' };
  }
}
