// Exercise modes (decision 31). Pure and deterministic: same inputs, same mode.
import type { Item, Progress } from './types.ts';

export type ExerciseMode = 'write' | 'fix' | 'order';

/** Every 3rd showing of a box ≥2 card with a commonMistake is "fix". */
export const FIX_EVERY = 3;

const MODES: readonly ExerciseMode[] = ['write', 'fix', 'order'];

/** Whitespace-separated words; punctuation stays attached ("today." is one token). */
export function answerTokens(answer: string): string[] {
  return answer.trim().split(/\s+/).filter((w) => w !== '');
}

/** "Sırala" needs at least two different words, otherwise the shuffle could not differ from the answer. */
export function canOrder(item: Item): boolean {
  return new Set(answerTokens(item.acceptedAnswers[0] ?? '')).size >= 2;
}

function canFix(item: Item): boolean {
  return (item.commonMistake ?? '').trim() !== '';
}

export interface ChooseModeInput {
  item: Item;
  /** Progress before this showing; null = new card. */
  progress: Progress | null;
  /** QueueEntry.kind: 'due' | 'new' | 'repeat' | 'practice' (a plain string so this works before 'practice' is in the type). */
  entryKind: string;
  /**
   * How many times the card was shown (graded) before this showing.
   * Main rounds: `showsBefore(progress)`. Practice rounds never touch progress,
   * so the caller passes the entry's position in the round instead (rotation).
   */
  showCount: number;
}

/** Showings before this one, from Progress.shows (records from before the field count as 1). */
export function showsBefore(progress: Progress | null): number {
  return progress ? (progress.shows ?? 1) : 0;
}

/** Decision 31. A mode that the item cannot support falls back to "write". */
export function chooseMode({ item, progress, entryKind, showCount }: ChooseModeInput): ExerciseMode {
  let mode: ExerciseMode;
  if (entryKind === 'repeat') mode = 'order';
  else if (entryKind === 'practice') mode = MODES[Math.abs(showCount) % MODES.length] ?? 'write';
  else if ((progress?.box ?? 1) === 1) mode = showCount === 0 ? 'order' : 'write';
  else mode = (showCount + 1) % FIX_EVERY === 0 ? 'fix' : 'write';
  if (mode === 'order' && !canOrder(item)) return 'write';
  if (mode === 'fix' && !canFix(item)) return 'write';
  return mode;
}

function hashSeed(seed: number | string): number {
  if (typeof seed === 'number') return seed >>> 0;
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** mulberry32. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Deterministic shuffle of the answer's words. With ≥2 distinct words the result
 * is never the original order (tokens compared by text, so repeated words cannot
 * hide an identical sequence). With fewer it returns the words as they are.
 */
export function shuffleTokens(answer: string, seed: number | string): string[] {
  const tokens = answerTokens(answer);
  if (new Set(tokens).size < 2) return tokens;
  const rand = rng(hashSeed(seed));
  const same = (a: readonly string[]) => a.every((w, i) => w === tokens[i]);
  for (let attempt = 0; attempt < 16; attempt++) {
    const out = [...tokens];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [out[i], out[j]] = [out[j] as string, out[i] as string];
    }
    if (!same(out)) return out;
  }
  // Practically unreachable: swap the first two different words.
  const out = [...tokens];
  const j = out.findIndex((w) => w !== out[0]);
  [out[0], out[j]] = [out[j] as string, out[0] as string];
  return out;
}
