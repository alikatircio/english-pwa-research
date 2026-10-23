// Which exercise shape the current queue entry gets (decisions 31, 36, 37). The card screen
// and the answer log both ask here, so they always agree.
import { chooseMode, contextCard, showsBefore, type ContextCard, type ExerciseMode } from '../domain/exerciseMode.ts';
import type { QueueEntry } from '../domain/types.ts';
import type { ReadyState } from './state.ts';

/**
 * e2e builds only: localStorage 'e2e-mode' = write | fix | order | context pins the mode,
 * so the older specs keep typing answers. Dead code in production builds.
 */
function e2eOverride(): ExerciseMode | undefined {
  if (import.meta.env.MODE !== 'e2e') return undefined;
  try {
    const v = localStorage.getItem('e2e-mode');
    return v === 'write' || v === 'fix' || v === 'order' || v === 'context' ? v : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Pure of state: progress is read before the grade, so the mode of a card does not
 * change between its question and its result. Practice entries rotate by their
 * position in the round (they never touch progress).
 */
export function modeForEntry(s: Pick<ReadyState, 'catalog' | 'progress'>, entry: QueueEntry, cursor: number, queueLength: number): ExerciseMode {
  const item = s.catalog.byId.get(entry.itemId);
  if (!item) return 'write';
  const forced = e2eOverride();
  if (forced) return forced === 'context' && !contextCard(item, showsBefore(s.progress.get(entry.itemId) ?? null)) ? 'write' : forced;
  const progress = s.progress.get(entry.itemId) ?? null;
  const showCount = entry.kind === ('practice' as string) ? cursor : showsBefore(progress);
  return chooseMode({ item, progress, entryKind: entry.kind, showCount, isLast: cursor >= queueLength - 1 });
}

/** The blanked sentence of the entry when its mode is 'context' (decision 42), else null. */
export function contextForEntry(s: Pick<ReadyState, 'catalog' | 'progress'>, entry: QueueEntry, cursor: number, queueLength: number): ContextCard | null {
  const item = s.catalog.byId.get(entry.itemId);
  if (!item || modeForEntry(s, entry, cursor, queueLength) !== 'context') return null;
  return contextCard(item, showsBefore(s.progress.get(entry.itemId) ?? null));
}

/** Seviye testi views, drawn above Settings. The attempt is in the store, so only the view is local UI state. */
export type DiagnosticView = { kind: 'test' } | { kind: 'result'; attemptId: string } | { kind: 'history' };
