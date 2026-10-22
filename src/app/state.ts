import type { NotebookContext } from '../domain/notebook.ts';
import type { DailyCounter, NotebookEntry, Progress, SessionState } from '../domain/types.ts';
import type { Catalog } from '../content/catalog.ts';

export type Screen = 'card' | 'done' | 'settings';
export type AppError = 'save-failed';
/** Overlay drawn over the current screen; the screen's state (session, draft) is kept. */
export type Overlay = { kind: 'notebook'; context?: NotebookContext | undefined };
/** Short confirmation shown after an overlay closes. */
export type Notice = { kind: 'notebook-saved'; duplicate: boolean; at: number };

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
  /** Notebook entries, oldest first (Slice 3). */
  notebook: readonly NotebookEntry[];
  overlay?: Overlay | undefined;
  notice?: Notice | undefined;
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
  | { type: 'error'; error: AppError }
  | { type: 'overlay'; overlay: Overlay | undefined }
  | { type: 'notebookAdded'; entry: NotebookEntry; notice: Notice }
  | { type: 'notice'; notice: Notice | undefined }
  | { type: 'screen'; screen: Screen }
  | { type: 'itemsImported'; catalog: Catalog; notebook: readonly NotebookEntry[]; session: SessionState | undefined }
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
    case 'screen':
      return { ...state, error: undefined, screen: action.screen };
    case 'itemsImported':
      return { ...state, busy: false, error: undefined, catalog: action.catalog, notebook: action.notebook, session: action.session };
  }
}
