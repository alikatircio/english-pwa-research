// The only side-effecting layer: domain → storage transaction → dispatch.
// Write first, then change the screen: what is shown is what is on disk.
import type { Clock } from '../domain/clock.ts';
import { isAccepted } from '../domain/normalize.ts';
import { applyGrade } from '../domain/scheduler.ts';
import { currentEntry } from '../domain/session.ts';
import type { AnswerLog, CardPhase, DailyCounter, Grade, GradedBy, HintStage, SessionState } from '../domain/types.ts';
import type { AppDb } from '../storage/db.ts';
import { commitGrade } from '../storage/repo.ts';
import type { Action, AppState, ReadyState } from './state.ts';

export interface ActionDeps {
  db: AppDb;
  clock: Clock;
  getState: () => AppState;
  dispatch: (a: Action) => void;
}

function ready(getState: () => AppState): ReadyState | undefined {
  const s = getState();
  return s.status === 'ready' ? s : undefined;
}

/** Decision 4: hintStage = min(box, 3); a new card is stage 1. (hints.ts takes over in T2.1.) */
function hintStage(box: number | undefined): HintStage {
  return Math.min(box ?? 1, 3) as HintStage;
}

export function createActions({ db, clock, getState, dispatch }: ActionDeps) {
  /** Grade the current card: progress + counter + log + session in one transaction. */
  async function grade(g: Grade, gradedBy: GradedBy, answer: string, phase: CardPhase): Promise<void> {
    const s = ready(getState);
    const session = s?.session;
    const entry = session && currentEntry(session);
    if (!s || !session || !entry || s.busy) return;

    const now = clock.now();
    const prev = s.progress.get(entry.itemId) ?? null;
    const progress = applyGrade(prev, g, entry.itemId, session.day, now);
    // The counter belongs to the day the queue was built (03 §4.5).
    const base: DailyCounter = s.counter.day === session.day ? s.counter : { day: session.day, newIntroduced: 0, reviewsAnswered: 0 };
    const counter: DailyCounter = {
      ...base,
      newIntroduced: base.newIntroduced + (entry.kind === 'new' ? 1 : 0),
      reviewsAnswered: base.reviewsAnswered + (entry.kind === 'due' ? 1 : 0),
    };
    const log: AnswerLog = {
      at: now,
      day: session.day,
      itemId: entry.itemId,
      answer,
      grade: g,
      gradedBy,
      hintStage: hintStage(prev?.box),
      isRepeat: false,
      boxBefore: prev?.box ?? null,
      boxAfter: progress.box,
    };
    const next: SessionState = { ...session, phase, draft: answer, updatedAt: now };

    dispatch({ type: 'busy' });
    try {
      await commitGrade(db, { progress, counter, log, session: next });
      dispatch({ type: 'graded', progress, counter, session: next });
    } catch {
      dispatch({ type: 'error', error: 'save-failed' });
    }
  }

  return {
    /** "Kontrol et": exact match after normalisation → auto "correct", saved immediately. */
    async submitAnswer(text: string): Promise<void> {
      const s = ready(getState);
      const session = s?.session;
      const entry = session && currentEntry(session);
      const answer = text.trim();
      if (!s || !session || !entry || s.busy || session.phase.tag !== 'question' || answer === '') return;
      const item = s.catalog.byId.get(entry.itemId);
      if (!item) return;
      const matched = isAccepted(answer, s.catalog.accepted.get(item.id) ?? item.acceptedAnswers);
      if (matched) {
        await grade('correct', 'auto', answer, { tag: 'result', answer, matched: true });
      } else {
        dispatch({ type: 'session', session: { ...session, draft: text, phase: { tag: 'result', answer, matched: false }, updatedAt: clock.now() } });
      }
    },

    /** "Sonraki": move to the next unanswered card, or finish. Synchronous so the caller can focus in the same gesture. */
    next(): void {
      const s = ready(getState);
      const session = s?.session;
      if (!s || !session || session.phase.tag !== 'result' || s.busy) return;
      let cursor = session.cursor + 1;
      while (cursor < session.queue.length) {
        const e = session.queue[cursor];
        if (e && s.catalog.byId.has(e.itemId) && !(e.kind === 'new' && s.progress.has(e.itemId))) break;
        cursor++;
      }
      if (cursor >= session.queue.length) {
        dispatch({ type: 'session', session: undefined, screen: 'done' });
        return;
      }
      dispatch({ type: 'session', session: { ...session, cursor, phase: { tag: 'question' }, draft: '', updatedAt: clock.now() } });
    },

    dismissError(): void {
      dispatch({ type: 'clearError' });
    },
  };
}

export type Actions = ReturnType<typeof createActions>;
