// Answer normalisation (decisions 7, 8, 19, 20, 22, 24; 07 §3.3).
// Exact equality after normalisation. No similarity score.
import { CONTRACTIONS } from './contractions.ts';

/** Step 2: iOS smart punctuation → ASCII. */
export function straightenQuotes(s: string): string {
  return s.replace(/[’‘‛ʼ′]/g, "'").replace(/[“”„″]/g, '"');
}

/** Step 3: never toLocaleLowerCase('tr') — "I'll" must not become "ı'll". */
export function lowerCase(s: string): string {
  return s.toLowerCase();
}

/** Step 4: double quotes and brackets carry no meaning for the answer. */
export function dropQuotesAndBrackets(s: string): string {
  return s.replace(/["()]/g, ' ');
}

/** Step 5 (decision 19): inner `, ; :` are ignored. Inner `. ? !` are kept (decision 24). */
export function dropInnerSeparators(s: string): string {
  return s.replace(/[,;:]/g, ' ');
}

/** Step 6 (decisions 20, 22): hyphen = space ("heads-up" = "heads up"). Dashes count as hyphens. */
export function hyphensToSpaces(s: string): string {
  return s.replace(/[-‐‑‒–—]/g, ' ');
}

/** Step 7 (decisions 20, 22): "3pm" = "3 pm". Splits every digit/letter boundary. */
export function splitDigitsAndLetters(s: string): string {
  return s.replace(/(\d)(\p{L})/gu, '$1 $2').replace(/(\p{L})(\d)/gu, '$1 $2');
}

const EDGE = /^[\s.!?…,;:-]+|[\s.!?…,;:-]+$/g;

/** Step 8: leading/trailing punctuation and whitespace. The apostrophe is kept. */
export function trimEdgePunctuation(s: string): string {
  return s.replace(EDGE, '');
}

/** Step 9. */
export function collapseWhitespace(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/** Step 10 (decision 8): token-level expansion with a fixed table, plus "can not" → "cannot". */
export function expandContractions(s: string): string {
  if (s === '') return s;
  const out: string[] = [];
  for (const token of s.split(' ')) {
    // A token may carry kept inner sentence punctuation ("it's." in "Done, it's. Thanks").
    const m = /^(.*?)([.!?…]*)$/u.exec(token);
    const core = m?.[1] ?? token;
    const tail = m?.[2] ?? '';
    const expanded = CONTRACTIONS.get(core);
    out.push(expanded === undefined ? token : expanded + tail);
  }
  return out.join(' ').replace(/\bcan not\b/g, 'cannot');
}

export function normalizeAnswer(raw: string): string {
  let s = raw.normalize('NFC');
  s = straightenQuotes(s);
  s = lowerCase(s);
  s = dropQuotesAndBrackets(s);
  s = dropInnerSeparators(s);
  s = hyphensToSpaces(s);
  s = splitDigitsAndLetters(s);
  s = trimEdgePunctuation(s);
  s = collapseWhitespace(s);
  return expandContractions(s);
}

/** Normalised accepted set; callers cache it per item. */
export function acceptedSet(accepted: readonly string[]): ReadonlySet<string> {
  return new Set(accepted.map(normalizeAnswer));
}

export function isAccepted(answer: string, accepted: readonly string[] | ReadonlySet<string>): boolean {
  const set = Array.isArray(accepted) ? acceptedSet(accepted) : (accepted as ReadonlySet<string>);
  const n = normalizeAnswer(answer);
  return n !== '' && set.has(n);
}
