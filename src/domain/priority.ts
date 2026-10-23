// Phase 5: new-card priority from the latest finished Seviye testi (decision 48). Pure.
import type { DiagnosticQuestion, Topic } from './extrasSchema.ts';
import { weakAreas } from './diagnostic.ts';
import type { DiagnosticAttempt } from './types.ts';

/** The attempt with the latest `finishedAt`; unfinished attempts are ignored. */
export function latestFinished(attempts: readonly DiagnosticAttempt[]): DiagnosticAttempt | undefined {
  let best: DiagnosticAttempt | undefined;
  for (const a of attempts) {
    if (a.finishedAt === undefined || !a.areaResults) continue;
    if (!best || a.finishedAt >= (best.finishedAt ?? 0)) best = a;
  }
  return best;
}

/**
 * Item ids to offer first among new cards: for each weak area of the frozen result,
 * the relatedItemIds of its questions and the itemIds of its topics. Undefined input
 * or no weak area gives an empty set.
 */
export function priorityItems(
  latest: DiagnosticAttempt | undefined,
  extras: { diagnostic: readonly DiagnosticQuestion[]; topics?: readonly Topic[] },
): Set<string> {
  const out = new Set<string>();
  if (!latest?.areaResults) return out;
  const weak = new Set<string>(weakAreas(latest.areaResults));
  for (const q of extras.diagnostic) if (weak.has(q.area)) for (const id of q.relatedItemIds) out.add(id);
  for (const t of extras.topics ?? []) if (weak.has(t.area)) for (const id of t.itemIds) out.add(id);
  return out;
}
