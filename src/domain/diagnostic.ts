// Seviye testi domain logic (12-pdf-roadmap Faz 2, decisions 47, 48). Pure functions only.
import { AREAS, type AreaId } from './areas.ts';
import { formatBookRef } from './bookRef.ts';
import { addDays, toDayKey } from './dates.ts';
import type { DiagnosticQuestion } from './extrasSchema.ts';
import type { DayKey, DiagnosticAttempt } from './types.ts';

export type OptionId = DiagnosticQuestion['options'][number]['id'];
export type Selection = OptionId[] | 'unsure';
export interface AreaResult {
  correct: number;
  unsure: number;
  wrong: number;
}
export type AreaResults = Record<string, AreaResult>;

/** Days after the latest finished attempt when a retake is suggested (decision 47: "4 hafta"). */
export const RETAKE_AFTER_DAYS = 28;
/** An area is weak when fewer than this many of its questions were answered correctly. */
export const WEAK_BELOW_CORRECT = 2;

// --- seeded shuffle ------------------------------------------------------------

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32: small deterministic PRNG in [0, 1). */
function rngFrom(seed: string): () => number {
  let a = hashSeed(seed);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates on a copy; same seed, same result. */
export function seededShuffle<T>(items: readonly T[], seed: string): T[] {
  const rng = rngFrom(seed);
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

/**
 * Option ids in display order. Seeded by attempt id + question id, so a resumed
 * attempt (same id) shows the identical order without storing it.
 */
export function optionOrder(attemptId: string, question: DiagnosticQuestion): OptionId[] {
  return seededShuffle(question.options.map((o) => o.id), `${attemptId}|${question.id}`);
}

// --- attempt lifecycle ---------------------------------------------------------

/** Whether the test can be taken at all: an empty bundle means unavailable. */
export const diagnosticAvailable = (questions: readonly DiagnosticQuestion[]): boolean => questions.length > 0;

/**
 * Question order: areas rotate (round k takes the k-th question of each area, area order
 * shuffled per round) and a question is never followed by one of the same area while
 * another area still has questions. The attempt id is the seed.
 */
export function orderQuestions(questions: readonly DiagnosticQuestion[], seed: string): string[] {
  const byArea = new Map<string, DiagnosticQuestion[]>();
  for (const a of AREAS) {
    const qs = questions.filter((q) => q.area === a.id);
    if (qs.length) byArea.set(a.id, seededShuffle(qs, `${seed}|area|${a.id}`));
  }
  const out: DiagnosticQuestion[] = [];
  const longest = Math.max(0, ...[...byArea.values()].map((l) => l.length));
  for (let k = 0; k < longest; k++) {
    const round = seededShuffle(
      [...byArea.values()].filter((l) => l.length > k).map((l) => l[k] as DiagnosticQuestion),
      `${seed}|round|${k}`,
    );
    const prev = out.at(-1);
    if (prev && round.length > 1 && round[0]?.area === prev.area) [round[0], round[1]] = [round[1] as DiagnosticQuestion, round[0] as DiagnosticQuestion];
    out.push(...round);
  }
  return out.map((q) => q.id);
}

export function startAttempt(questions: readonly DiagnosticQuestion[], opts: { id: string; now: number; extrasVersion: string }): DiagnosticAttempt {
  return {
    id: opts.id,
    startedAt: opts.now,
    extrasVersion: opts.extrasVersion,
    order: orderQuestions(questions, opts.id),
    cursor: 0,
    answers: {},
  };
}

/** Records (or replaces) one answer. 'unsure' stores no options. The cursor is not moved. */
export function answerQuestion(attempt: DiagnosticAttempt, questionId: string, selected: Selection): DiagnosticAttempt {
  if (!attempt.order.includes(questionId)) return attempt;
  const entry = selected === 'unsure' ? { chosen: [], unsure: true } : { chosen: [...new Set(selected)].sort(), unsure: false };
  return { ...attempt, answers: { ...attempt.answers, [questionId]: entry } };
}

const clampCursor = (attempt: DiagnosticAttempt, i: number): number => Math.max(0, Math.min(attempt.order.length - 1, i));

export const nextQuestion = (attempt: DiagnosticAttempt): DiagnosticAttempt => ({ ...attempt, cursor: clampCursor(attempt, attempt.cursor + 1) });
export const prevQuestion = (attempt: DiagnosticAttempt): DiagnosticAttempt => ({ ...attempt, cursor: clampCursor(attempt, attempt.cursor - 1) });

export const answeredCount = (attempt: DiagnosticAttempt): number => Object.keys(attempt.answers).length;
export const isComplete = (attempt: DiagnosticAttempt): boolean => attempt.order.every((id) => attempt.answers[id] !== undefined);

// --- scoring -------------------------------------------------------------------

export type Verdict = 'correct' | 'unsure' | 'wrong';

/** Correct only when the chosen set equals the correct set exactly. Unanswered counts as wrong. */
export function verdictOf(attempt: DiagnosticAttempt, question: DiagnosticQuestion): Verdict {
  const a = attempt.answers[question.id];
  if (!a) return 'wrong';
  if (a.unsure) return 'unsure';
  const chosen = new Set(a.chosen);
  const same = chosen.size === question.correct.length && question.correct.every((c) => chosen.has(c));
  return same ? 'correct' : 'wrong';
}

/** Per area that has at least one question in the attempt, in AREAS order. */
export function scoreByArea(attempt: DiagnosticAttempt, questions: readonly DiagnosticQuestion[]): AreaResults {
  const inAttempt = new Set(attempt.order);
  const out: AreaResults = {};
  for (const area of AREAS) {
    const qs = questions.filter((q) => q.area === area.id && inAttempt.has(q.id));
    if (!qs.length) continue;
    const r: AreaResult = { correct: 0, unsure: 0, wrong: 0 };
    for (const q of qs) r[verdictOf(attempt, q)]++;
    out[area.id] = r;
  }
  return out;
}

/**
 * Weak-area rule (roadmap 2.2 "alanda doğru < 2"): an area is weak when fewer than
 * 2 of its (3) questions are correct, i.e. unsure or wrong in 2 or more. AREAS order.
 */
export function weakAreas(results: AreaResults): AreaId[] {
  return AREAS.filter((a) => (results[a.id]?.correct ?? Infinity) < WEAK_BELOW_CORRECT).map((a) => a.id);
}

/** Freezes the result into the attempt (areaResults). */
export function finishAttempt(attempt: DiagnosticAttempt, questions: readonly DiagnosticQuestion[], now: number): DiagnosticAttempt {
  return { ...attempt, finishedAt: now, areaResults: scoreByArea(attempt, questions) };
}

// --- study pointers ------------------------------------------------------------

export interface StudyPointers {
  /** Formatted refs, e.g. "Gram ünite 25 · k.50 · PDF 62", unique, in question order. */
  refs: string[];
  relatedItemIds: string[];
}

export function studyPointers(area: AreaId, questions: readonly DiagnosticQuestion[]): StudyPointers {
  const qs = questions.filter((q) => q.area === area);
  const refs = new Set<string>();
  const ids = new Set<string>();
  for (const q of qs) {
    for (const r of q.refs) refs.add(formatBookRef(r));
    for (const id of q.relatedItemIds) ids.add(id);
  }
  return { refs: [...refs], relatedItemIds: [...ids] };
}

// --- history -------------------------------------------------------------------

const finished = (attempts: readonly DiagnosticAttempt[]) =>
  attempts.filter((a) => a.finishedAt !== undefined && a.areaResults).toSorted((a, b) => (a.finishedAt ?? 0) - (b.finishedAt ?? 0));

export interface AreaComparison {
  area: AreaId;
  first: AreaResult | undefined;
  latest: AreaResult | undefined;
}
export interface FirstVsLatest {
  first: DiagnosticAttempt;
  latest: DiagnosticAttempt;
  /** False when only one finished attempt exists (first === latest). */
  hasComparison: boolean;
  areas: AreaComparison[];
}

/** First vs latest finished attempt per area; undefined with no finished attempt. */
export function firstVsLatest(attempts: readonly DiagnosticAttempt[]): FirstVsLatest | undefined {
  const done = finished(attempts);
  const first = done[0];
  const latest = done.at(-1);
  if (!first || !latest) return undefined;
  return {
    first,
    latest,
    hasComparison: first.id !== latest.id,
    areas: AREAS.map((a) => ({ area: a.id, first: first.areaResults?.[a.id], latest: latest.areaResults?.[a.id] })),
  };
}

/** Day (local) of the latest finished attempt + 28 days; undefined with none. */
export function retakeDay(attempts: readonly DiagnosticAttempt[]): DayKey | undefined {
  const latest = finished(attempts).at(-1);
  return latest?.finishedAt === undefined ? undefined : addDays(toDayKey(latest.finishedAt), RETAKE_AFTER_DAYS);
}

/** A retake is suggested once today is on or after the retake day (>= 28 days). */
export function retakeSuggested(attempts: readonly DiagnosticAttempt[], today: DayKey): boolean {
  const day = retakeDay(attempts);
  return day !== undefined && today >= day;
}
