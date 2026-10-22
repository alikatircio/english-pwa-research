// The only side-effecting layer: domain → storage transaction → dispatch.
// Write first, then change the screen: what is shown is what is on disk.
import type { Clock } from '../domain/clock.ts';
import { hintStageFor } from '../domain/hints.ts';
import { isAccepted } from '../domain/normalize.ts';
import { applyGrade } from '../domain/scheduler.ts';
import { currentEntry } from '../domain/session.ts';
import type { AnswerLog, CardPhase, DailyCounter, Flag, Grade, GradedBy, SessionState, UndoSnapshot } from '../domain/types.ts';
import type { AppDb } from '../storage/db.ts';
import { clearSession, commitGrade, saveSession, toggleFlag, undoGrade } from '../storage/repo.ts';
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

/** Decision 10: "Geri al" stays for 4 s after a self-grade. */
export const UNDO_WINDOW_MS = 4000;

export function createActions({ db, clock, getState, dispatch }: ActionDeps) {
  /**
   * Session-only writes (draft, cursor, phase) are write-behind: losing one costs
   * at most a draft, never a grade, so a failure is not surfaced (grades are
   * written atomically in commitGrade).
   */
  function persistSession(session: SessionState | undefined): void {
    void (session ? saveSession(db, session) : clearSession(db)).catch(() => undefined);
  }

  function setSession(session: SessionState | undefined, screen?: 'card' | 'done'): void {
    dispatch(screen ? { type: 'session', session, screen } : { type: 'session', session });
    persistSession(session);
  }

  /** Grade the current card: progress + counter + log + session in one transaction. */
  async function grade(g: Grade, gradedBy: GradedBy, answer: string, phase: CardPhase, undoable = false): Promise<void> {
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
      hintStage: hintStageFor(prev),
      isRepeat: false,
      boxBefore: prev?.box ?? null,
      boxAfter: progress.box,
    };
    const next: SessionState = { ...session, phase, draft: answer, updatedAt: now };
    const undo: Omit<UndoSnapshot, 'logId'> | undefined = undoable
      ? { itemId: entry.itemId, prevProgress: prev, prevCounter: base, expiresAt: now + UNDO_WINDOW_MS }
      : undefined;

    dispatch({ type: 'busy' });
    try {
      const logId = await commitGrade(db, undo ? { progress, counter, log, session: next, undo } : { progress, counter, log, session: next });
      const stored: SessionState = undo ? { ...next, undo: { ...undo, logId } } : next;
      dispatch({ type: 'graded', progress, counter, session: stored });
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
        setSession({ ...session, draft: text, phase: { tag: 'result', answer, matched: false }, updatedAt: clock.now() });
      }
    },

    /** Self-grade an unmatched answer (decision 10): progress + answer log written immediately. */
    async selfGrade(g: Grade): Promise<void> {
      const phase = ready(getState)?.session?.phase;
      if (!phase || phase.tag !== 'result' || phase.matched || phase.grade) return;
      await grade(g, 'self', phase.answer, { ...phase, grade: g }, true);
    },

    /** "Geri al" within 4 s of a self-grade: progress, counter and log back as before, result screen ungraded. */
    async undo(): Promise<void> {
      const s = ready(getState);
      const session = s?.session;
      const snapshot = session?.undo;
      const phase = session?.phase;
      if (!s || !session || !snapshot || s.busy || !phase || phase.tag !== 'result' || phase.matched || !phase.grade) return;
      if (clock.now() > snapshot.expiresAt) return;
      const restored: SessionState = { ...session, phase: { tag: 'result', answer: phase.answer, matched: false }, updatedAt: clock.now() };
      delete restored.undo;
      dispatch({ type: 'busy' });
      try {
        await undoGrade(db, snapshot, restored);
        dispatch({ type: 'undone', itemId: snapshot.itemId, progress: snapshot.prevProgress, counter: snapshot.prevCounter, session: restored });
      } catch {
        dispatch({ type: 'error', error: 'save-failed' });
      }
    },

    /** "Sonraki": move to the next unanswered card, or finish. Synchronous so the caller can focus in the same gesture. */
    next(): void {
      const s = ready(getState);
      const session = s?.session;
      const phase = session?.phase;
      if (!s || !session || !phase || phase.tag !== 'result' || s.busy) return;
      if (!phase.matched && !phase.grade) return; // must self-grade first
      let cursor = session.cursor + 1;
      while (cursor < session.queue.length) {
        const e = session.queue[cursor];
        if (e && s.catalog.byId.has(e.itemId) && !s.flags.has(e.itemId) && !(e.kind === 'new' && s.progress.has(e.itemId))) break;
        cursor++;
      }
      if (cursor >= session.queue.length) {
        setSession(undefined, 'done');
        return;
      }
      const moved: SessionState = { ...session, cursor, phase: { tag: 'question' }, draft: '', updatedAt: clock.now() };
      delete moved.undo; // the undo window ends with the card
      setSession(moved);
    },

    /** Debounced by the caller. Ignored if the card moved on meanwhile. */
    saveDraft(cursor: number, text: string): void {
      const session = ready(getState)?.session;
      if (!session || session.cursor !== cursor || session.phase.tag !== 'question' || session.draft === text) return;
      setSession({ ...session, draft: text, updatedAt: clock.now() });
    },

    /** ⚑ "Bu yanlış olabilir" (decision 12): flag/unflag the current card; flagged cards are not queued again. */
    async toggleFlag(): Promise<void> {
      const s = ready(getState);
      const session = s?.session;
      const entry = session && currentEntry(session);
      if (!s || !session || !entry || s.busy) return;
      const phase = session.phase;
      const userAnswer = phase.tag === 'result' ? phase.answer : session.draft.trim();
      const flag: Flag = {
        itemId: entry.itemId,
        flaggedAt: clock.now(),
        screen: phase.tag,
        contentVersion: s.catalog.contentVersion,
        ...(userAnswer ? { userAnswer } : {}),
      };
      dispatch({ type: 'busy' });
      try {
        const flagged = await toggleFlag(db, flag);
        const flags = new Set(s.flags);
        if (flagged) flags.add(entry.itemId);
        else flags.delete(entry.itemId);
        dispatch({ type: 'flags', flags });
      } catch {
        dispatch({ type: 'error', error: 'save-failed' });
      }
    },

    dismissError(): void {
      dispatch({ type: 'clearError' });
    },
  };
}

export type Actions = ReturnType<typeof createActions>;
