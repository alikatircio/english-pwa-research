import type { DailyCounter, Progress, SessionState } from '../domain/types.ts';
import type { Catalog } from '../content/catalog.ts';

export type Screen = 'home' | 'card' | 'roundEnd';
export type AppError = 'save-failed';

/** What the round-end screen shows (05 §3). Kept in memory only, never saved. */
export interface RoundSummary {
  studiedChunks: readonly string[];
  /** Cards are left today, so "Bir tur daha" makes sense. */
  moreToday: boolean;
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
  /** Day switch or round start: today's counter and the session to show. */
  | { type: 'day'; counter: DailyCounter; session: SessionState | undefined; screen: Screen }
  | { type: 'roundEnded'; summary: RoundSummary }
  | { type: 'screen'; screen: Screen }
  | { type: 'error'; error: AppError }
  | { type: 'clearError' };

/** A grade only updates the in-memory counter of the day it belongs to. */
function sameDay(current: DailyCounter, written: DailyCounter): DailyCounter {
  return written.day === current.day ? written : current;
}

export const initialState: AppState = { status: 'loading' };

export function appReducer(state: AppState, action: Action): AppState {
  if (action.type === 'booted') return { status: 'ready', busy: false, ...action.state };
  if (action.type === 'fatal') return { status: 'fatal', message: action.message };
  if (state.status !== 'ready') return state;
  switch (action.type) {
    case 'busy':
      return { ...state, busy: true };
    case 'session':
      return { ...state, busy: false, session: action.session, screen: action.screen ?? state.screen };
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
  }
}
