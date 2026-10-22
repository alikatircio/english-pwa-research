// Pure helper for modelBlanks (decision 42). A blanked sentence is the original
// with each critical word replaced by "___". No React, no DOM.

export const BLANK_TOKEN = '___';

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Recover the words hidden behind each "___" by matching `blanked` against
 * `original`. Returns the answers in order, or null when `blanked` has no
 * blank or is not a blanked version of `original`. Each answer is one
 * non-space token, so refilling the blanks always reproduces `original`.
 */
export function blankAnswers(blanked: string, original: string): string[] | null {
  const parts = blanked.split(BLANK_TOKEN);
  if (parts.length < 2) return null;
  const pattern = new RegExp(`^${parts.map(escapeRegExp).join('(\\S+?)')}$`);
  const m = pattern.exec(original);
  if (!m) return null;
  return m.slice(1);
}

/** Put `answers` back into the blanks of `blanked` (inverse of blankAnswers). */
export function refillBlanks(blanked: string, answers: readonly string[]): string {
  const parts = blanked.split(BLANK_TOKEN);
  return parts.map((p, i) => (i < answers.length ? p + (answers[i] ?? '') : p)).join('');
}
