// The only side-effecting layer: domain → storage transaction → dispatch.
// Write first, then change the screen: what is shown is what is on disk.
import type { Clock } from '../domain/clock.ts';
import { hintStageFor } from '../domain/hints.ts';
import { isAccepted } from '../domain/normalize.ts';
import { applyGrade } from '../domain/scheduler.ts';
import { countFirstAnswer, currentEntry, emptyCounter, isSessionStale, onFirstAnswer, todayCount } from '../domain/session.ts';
import type { AnswerLog, CardPhase, DailyCounter, DayKey, Flag, Grade, GradedBy, SessionState, UndoSnapshot } from '../domain/types.ts';
import type { AppDb } from '../storage/db.ts';
import { clearSession, commitGrade, loadCounter, saveSession, toggleFlag, undoGrade } from '../storage/repo.ts';
import { freshRound, nextCard, poolsOf } from './round.ts';
import type { Action, AppState, ReadyState, Screen } from './state.ts';

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

  function setSession(session: SessionState | undefined, screen?: Screen): void {
    dispatch(screen ? { type: 'session', session, screen } : { type: 'session', session });
    persistSession(session);
  }

  /**
   * Grade the current card: progress + counter + log + session in one transaction.
   * - First answer of a main card: Leitner (applyGrade) on the day of the answer,
   *   the counter of the day the round was built (03 §4.5), session effects
   *   (repeat, 3-wrong breather) from onFirstAnswer.
   * - End-of-round repeat: log only; the box and the counter stay (decision 5).
   */
  async function grade(g: Grade, gradedBy: GradedBy, answer: string, phase: CardPhase, undoable = false): Promise<void> {
    const s = ready(getState);
    const session = s?.session;
    const entry = session && currentEntry(session);
    if (!s || !session || !entry || s.busy) return;

    dispatch({ type: 'busy' });
    try {
      const now = clock.now();
      const answerDay = clock.today();
      const isRepeat = entry.kind === 'repeat';
      const prev = s.progress.get(entry.itemId) ?? null;
      const progress = isRepeat ? undefined : applyGrade(prev, g, entry.itemId, answerDay, now);
      const base = s.counter.day === session.day ? s.counter : await loadCounter(db, session.day);
      const counter = countFirstAnswer(base, entry.kind, session.day);
      const log: AnswerLog = {
        at: now,
        day: answerDay,
        itemId: entry.itemId,
        answer,
        grade: g,
        gradedBy,
        hintStage: hintStageFor(prev),
        isRepeat,
        boxBefore: prev?.box ?? null,
        boxAfter: progress ? progress.box : (prev?.box ?? null),
      };
      const next: SessionState = { ...onFirstAnswer(session, g, poolsOf(s, base)), phase, draft: answer, updatedAt: now };
      const undo: Omit<UndoSnapshot, 'logId'> | undefined = undoable
        ? {
            itemId: entry.itemId,
            prevProgress: prev,
            prevCounter: base,
            prevRound: {
              queue: session.queue,
              repeatQueued: session.repeatQueued,
              consecutiveWrong: session.consecutiveWrong,
              studiedChunks: session.studiedChunks,
            },
            expiresAt: now + UNDO_WINDOW_MS,
          }
        : undefined;
      const commit = { counter, log, session: next, ...(progress ? { progress } : {}) };
      const logId = await commitGrade(db, undo ? { ...commit, undo } : commit);
      const stored: SessionState = undo ? { ...next, undo: { ...undo, logId } } : next;
      dispatch(progress ? { type: 'graded', progress, counter, session: stored } : { type: 'graded', counter, session: stored });
    } catch {
      dispatch({ type: 'error', error: 'save-failed' });
    }
  }

  /**
   * Today's counter. Only a round writes a counter and a round counts into the
   * in-memory one, so a day other than the in-memory one has no counter yet
   * (Home also reloads it from the DB, see refreshHome).
   */
  function todayCounter(s: ReadyState, today: DayKey): DailyCounter {
    return s.counter.day === today ? s.counter : emptyCounter(today);
  }

  /** "Başla" / "Bir tur daha": a new round from buildRound, or Home ("Bugün bitti") if nothing is left. Synchronous for iOS focus. */
  function startRound(): void {
    const s = ready(getState);
    if (!s || s.busy || s.session) return;
    const counter = todayCounter(s, clock.today());
    const session = freshRound(s, counter, clock);
    dispatch({ type: 'day', counter, session, screen: session ? 'card' : 'home' });
    if (session) persistSession(session);
  }

  return {
    startRound,

    /** "Devam et": back to the open round where it was left; a stale one (other day, > 12 h) is replaced by a new round. */
    resume(): void {
      const s = ready(getState);
      const session = s?.session;
      if (!s || !session || s.busy) return;
      if (isSessionStale(session, clock.today(), clock.now())) {
        setSession(undefined);
        startRound();
        return;
      }
      dispatch({ type: 'screen', screen: 'card' });
    },

    /** "Bu kadar": leave the round end for Home. No confirmation, no cost (05 §2). */
    finish(): void {
      dispatch({ type: 'screen', screen: 'home' });
    },

    /**
     * On Home (mount and return to the app): switch to a new day if the date
     * changed, dropping a stale round silently (02 §3) and loading today's counter.
     */
    async refreshHome(): Promise<void> {
      const s = ready(getState);
      if (!s) return;
      const today = clock.today();
      const stale = s.session !== undefined && isSessionStale(s.session, today, clock.now());
      if (!stale && s.counter.day === today) return;
      const counter = s.counter.day === today ? s.counter : await loadCounter(db, today).catch(() => emptyCounter(today));
      const now = ready(getState);
      if (!now || now.screen !== 'home' || now.session !== s.session) return; // the user moved on meanwhile
      if (stale) persistSession(undefined);
      dispatch({ type: 'day', counter, session: stale ? undefined : s.session, screen: 'home' });
    },

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

    /**
     * "Geri al" within 4 s of a self-grade: progress, counter and log back as
     * before, the round's queue, repeats and wrong streak as before the grade,
     * result screen ungraded.
     */
    async undo(): Promise<void> {
      const s = ready(getState);
      const session = s?.session;
      const snapshot = session?.undo;
      const phase = session?.phase;
      if (!s || !session || !snapshot || s.busy || !phase || phase.tag !== 'result' || phase.matched || !phase.grade) return;
      if (clock.now() > snapshot.expiresAt) return;
      const restored: SessionState = {
        ...session,
        ...snapshot.prevRound,
        phase: { tag: 'result', answer: phase.answer, matched: false },
        updatedAt: clock.now(),
      };
      delete restored.undo;
      dispatch({ type: 'busy' });
      try {
        await undoGrade(db, snapshot, restored);
        dispatch({ type: 'undone', itemId: snapshot.itemId, progress: snapshot.prevProgress, counter: snapshot.prevCounter, session: restored });
      } catch {
        dispatch({ type: 'error', error: 'save-failed' });
      }
    },

    /** "Sonraki": next card of the round (skipping flagged ones), or the round end. Synchronous so the caller can focus in the same gesture. */
    next(): void {
      const s = ready(getState);
      const session = s?.session;
      const phase = session?.phase;
      if (!s || !session || !phase || phase.tag !== 'result' || s.busy) return;
      if (!phase.matched && !phase.grade) return; // must self-grade first
      const moved = nextCard(session, s);
      if (moved === 'round-end') {
        const today = clock.today();
        const moreToday = todayCount(poolsOf(s, todayCounter(s, today)), today) > 0;
        persistSession(undefined);
        dispatch({ type: 'roundEnded', summary: { studiedChunks: session.studiedChunks, moreToday } });
        return;
      }
      setSession({ ...moved, updatedAt: clock.now() });
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
