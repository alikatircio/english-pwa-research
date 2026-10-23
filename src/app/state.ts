import type { NotebookContext } from '../domain/notebook.ts';
import type { Message } from '../domain/extrasSchema.ts';
import type { DailyCounter, DiagnosticAttempt, NotebookEntry, Progress, SessionState } from '../domain/types.ts';
import type { Catalog } from '../content/catalog.ts';
import type { AppMeta } from './meta.ts';

export type Screen = 'home' | 'card' | 'roundEnd' | 'settings';
export type AppError = 'save-failed';
/** Overlay drawn over the current screen; the screen's state (session, draft) is kept. */
export type Overlay = { kind: 'notebook'; context?: NotebookContext | undefined };
/** Short confirmation shown after an overlay closes. */
export type Notice = { kind: 'notebook-saved'; duplicate: boolean; at: number };

/** What the round-end screen shows (05 §3). Kept in memory only, never saved. */
export interface RoundSummary {
  studiedChunks: readonly string[];
  /** Cards are left today, so "Bir tur daha" makes sense. */
  moreToday: boolean;
}

/** Seviye testi: every attempt (oldest first) and the unfinished one, if any. Never touches progress or counters. */
export interface DiagnosticState {
  attempts: readonly DiagnosticAttempt[];
  open?: DiagnosticAttempt | undefined;
}

export type AppState =
  | { status: 'loading' }
  | { status: 'fatal'; message: string }
  | ReadyState;

export interface ReadyState {
  status: 'ready';
  screen: Screen;
  catalog: Catalog;
  progress: ReadonlyMap<string, Progress>;
  flags: ReadonlySet<string>;
  /**
   * Counter of the current day. While a round is open it is the round's day
   * (03 §4.5): a round that crosses midnight keeps counting for the day it was built.
   */
  counter: DailyCounter;
  session: SessionState | undefined;
  /** Set when a round ends; cleared when the next round starts. */
  lastRound?: RoundSummary | undefined;
  /** Notebook entries, oldest first (Slice 3). */
  notebook: readonly NotebookEntry[];
  overlay?: Overlay | undefined;
  notice?: Notice | undefined;
  diagnostic?: DiagnosticState | undefined;
  /** Decision 49: verified messages (from extras) and the newest answer-log `at` per messageId; absent = no message step. */
  messages?: readonly Message[] | undefined;
  messageLastAt?: ReadonlyMap<string, number> | undefined;
  /** Phase 5: new-card priority from the latest finished Seviye testi (decision 48). Absent or empty = normal order. */
  newPriority?: ReadonlySet<string> | undefined;
  /** The `meta` store (last export, …). */
  meta: AppMeta;
  /** A write is in flight; buttons that write are disabled. */
  busy: boolean;
  error?: AppError;
}

export type Action =
  | { type: 'booted'; state: Omit<ReadyState, 'status' | 'busy'> }
  | { type: 'fatal'; message: string }
  | { type: 'busy' }
  | { type: 'session'; session: SessionState | undefined; screen?: Screen }
  | { type: 'graded'; progress?: Progress; counter: DailyCounter; session: SessionState }
  | { type: 'undone'; itemId: string; progress: Progress | null; counter: DailyCounter; session: SessionState }
  | { type: 'flags'; flags: ReadonlySet<string> }
  /** Message step checked (decision 49): answer-log rows only; stamps the message's last practice time. */
  | { type: 'messageAnswered'; messageId: string; at: number; session: SessionState }
  /** Day switch or round start: today's counter and the session to show. */
  | { type: 'day'; counter: DailyCounter; session: SessionState | undefined; screen: Screen }
  | { type: 'roundEnded'; summary: RoundSummary }
  | { type: 'screen'; screen: Screen }
  | { type: 'error'; error: AppError }
  | { type: 'overlay'; overlay: Overlay | undefined }
  | { type: 'notebookAdded'; entry: NotebookEntry; notice: Notice }
  | { type: 'notice'; notice: Notice | undefined }
  | { type: 'itemsImported'; catalog: Catalog; notebook: readonly NotebookEntry[]; session: SessionState | undefined; counter: DailyCounter }
  | { type: 'meta'; meta: AppMeta }
  /** After a backup restore: everything reloaded from disk; overlay and notice are kept as they are. */
  | { type: 'restored'; state: Omit<ReadyState, 'status' | 'busy'> }
  /** Diagnostic attempts changed (start, answer, move, finish). */
  | { type: 'diagnostic'; diagnostic: DiagnosticState; newPriority: ReadonlySet<string> }
  | { type: 'clearError' };

/** A grade only updates the in-memory counter of the day it belongs to. */
function sameDay(current: DailyCounter, written: DailyCounter): DailyCounter {
  return written.day === current.day ? written : current;
}

export const initialState: AppState = { status: 'loading' };

/**
 * Whether a reload interrupts nothing (07 §6.2, review 09 #3): still loading or
 * failed, or Home with no open round and no write in flight.
 */
export function mayReloadForDb(state: AppState): boolean {
  return state.status !== 'ready' || (state.screen === 'home' && state.session === undefined && !state.busy);
}

export function appReducer(state: AppState, action: Action): AppState {
  if (action.type === 'booted') return { status: 'ready', busy: false, ...action.state };
  if (action.type === 'fatal') return { status: 'fatal', message: action.message };
  if (state.status !== 'ready') return state;
  switch (action.type) {
    case 'busy':
      return { ...state, busy: true };
    case 'session':
      // Session-only (write-behind) updates never end a write in flight: busy is left to its result.
      return { ...state, session: action.session, screen: action.screen ?? state.screen };
    case 'graded': {
      let progress = state.progress;
      if (action.progress) {
        const next = new Map(progress);
        next.set(action.progress.itemId, action.progress);
        progress = next;
      }
      return { ...state, busy: false, error: undefined, progress, counter: sameDay(state.counter, action.counter), session: action.session };
    }
    case 'undone': {
      const progress = new Map(state.progress);
      if (action.progress) progress.set(action.itemId, action.progress);
      else progress.delete(action.itemId);
      return { ...state, busy: false, error: undefined, progress, counter: sameDay(state.counter, action.counter), session: action.session };
    }
    case 'messageAnswered': {
      const messageLastAt = new Map(state.messageLastAt ?? []);
      messageLastAt.set(action.messageId, action.at);
      return { ...state, busy: false, error: undefined, messageLastAt, session: action.session };
    }
    case 'flags':
      return { ...state, busy: false, error: undefined, flags: action.flags };
    case 'day':
      return { ...state, busy: false, error: undefined, counter: action.counter, session: action.session, screen: action.screen, lastRound: undefined };
    case 'roundEnded':
      return { ...state, busy: false, error: undefined, session: undefined, screen: 'roundEnd', lastRound: action.summary };
    case 'screen':
      return { ...state, error: undefined, screen: action.screen };
    case 'error':
      return { ...state, busy: false, error: action.error };
    case 'clearError':
      return { ...state, error: undefined };
    case 'overlay':
      return { ...state, error: undefined, overlay: action.overlay };
    case 'notebookAdded':
      return {
        ...state,
        busy: false,
        error: undefined,
        overlay: undefined,
        notebook: [...state.notebook, action.entry],
        notice: action.notice,
      };
    case 'notice':
      return { ...state, notice: action.notice };
    case 'itemsImported':
      return { ...state, busy: false, error: undefined, catalog: action.catalog, notebook: action.notebook, session: action.session, counter: action.counter };
    case 'meta':
      return { ...state, meta: action.meta };
    case 'diagnostic':
      return { ...state, busy: false, error: undefined, diagnostic: action.diagnostic, newPriority: action.newPriority };
    case 'restored':
      return { ...state, ...action.state, busy: false, error: undefined, lastRound: undefined };
  }
}
