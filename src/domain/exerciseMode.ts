// Exercise modes (decisions 31, 36, 37, 42). Pure and deterministic: same inputs, same mode.
import { blankAnswers, refillBlanks } from './blankAnswers.ts';
import { normalizeAnswer } from './normalize.ts';
import type { ExerciseMode, Item, Progress } from './types.ts';

export type { ExerciseMode };

/** Decision 42: box ≥2 main cards cycle write, context, write, fix (by showing count). */
export const ROTATION = ['write', 'context', 'write', 'fix'] as const;
/** Decision 42: "context" from this Leitner box on. */
export const CONTEXT_MIN_BOX = 2;

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

/** A fill-in-the-blanks card (decisions 42, 44b): the blanked sentence, its answers and the full original. */
export interface ContextCard {
  blanked: string;
  original: string;
  answers: string[];
  /** True for the item's daily-life sentence (decision 44b); absent for work sentences. */
  daily?: true;
}

/**
 * The 'context' card of an item, or null when nothing is usable. Candidates: the non-null
 * modelBlanks entries (consistent with modelSentences[i+1]) plus dailyContext. A context
 * card only shows up once per rotation cycle, so the pick is by cycle number, not by raw
 * showCount: with both kinds it alternates work, daily, work, ... (cycling through the
 * work entries); with one kind it cycles through that kind.
 */
export function contextCard(item: Item, showCount: number): ContextCard | null {
  const work: ContextCard[] = [];
  (item.modelBlanks ?? []).forEach((blanked, i) => {
    const original = item.modelSentences[i + 1];
    if (blanked === null || original === undefined) return;
    const answers = blankAnswers(blanked, original);
    if (answers) work.push({ blanked, original, answers });
  });
  let daily: ContextCard | undefined;
  if (item.dailyContext) {
    const { blank, sentence } = item.dailyContext;
    const answers = blankAnswers(blank, sentence);
    if (answers) daily = { blanked: blank, original: sentence, answers, daily: true };
  }
  const k = Math.floor(Math.abs(showCount) / ROTATION.length);
  if (work.length > 0 && daily) return k % 2 === 1 ? daily : (work[(k / 2) % work.length] as ContextCard);
  return daily ?? work[k % work.length] ?? null;
}

/** Decision 42: every blank equal to its answer after normalisation. */
export function gradeContext(values: readonly string[], answers: readonly string[]): boolean {
  return values.length === answers.length && answers.every((a, i) => normalizeAnswer(values[i] ?? '') === normalizeAnswer(a));
}

/** The sentence the user built, for the result screen and the log. */
export function contextAnswer(card: ContextCard, values: readonly string[]): string {
  return values.every((v) => v.trim() === '') ? '' : refillBlanks(card.blanked, values.map((v) => v.trim()));
}

export interface ChooseModeInput {
  item: Item;
  /** Progress before this showing; null = new card. */
  progress: Progress | null;
  /** QueueEntry.kind: 'due' | 'new' | 'repeat' | 'practice' (a plain string so callers need no cast). */
  entryKind: string;
  /**
   * How many times the card was shown (graded) before this showing.
   * Main rounds: `showsBefore(progress)`. Practice rounds never touch progress,
   * so the caller passes the entry's position in the round instead (rotation).
   */
  showCount: number;
  /** Last card of the round: never "fix" (decision 37). */
  isLast: boolean;
}

/** Showings before this one, from Progress.shows (records from before the field count as 1). */
export function showsBefore(progress: Progress | null): number {
  return progress ? (progress.shows ?? 1) : 0;
}

/** Decision 37: "fix" only from this Leitner box on. */
export const FIX_MIN_BOX = 3;

/**
 * Decisions 36, 37, 42. "Sırala" lives in free practice only. "Hatayı düzelt" needs
 * box ≥ 3, a commonMistake and a card that is not last in the round. Main-round
 * cards from box 2 cycle write, context, write, fix (decision 42; "context" needs
 * a modelBlanks entry, "fix" its conditions). Everything else is "Yaz". A mode the item or
 * the position cannot support falls back to "write".
 */
export function chooseMode({ item, progress, entryKind, showCount, isLast }: ChooseModeInput): ExerciseMode {
  const fixOk = (progress?.box ?? 1) >= FIX_MIN_BOX && canFix(item) && !isLast;
  if (entryKind === 'practice') {
    const mode = MODES[Math.abs(showCount) % MODES.length] ?? 'write';
    if (mode === 'order') return canOrder(item) ? 'order' : 'write';
    return mode === 'fix' && fixOk ? 'fix' : 'write';
  }
  if (entryKind === 'repeat' || entryKind === 'new') return 'write';
  if ((progress?.box ?? 1) < CONTEXT_MIN_BOX) return 'write';
  const slot = ROTATION[Math.abs(showCount) % ROTATION.length];
  if (slot === 'fix') return fixOk ? 'fix' : 'write';
  if (slot === 'context') return contextCard(item, showCount) ? 'context' : 'write';
  return 'write';
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
