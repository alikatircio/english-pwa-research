// The only side-effecting layer: domain → storage transaction → dispatch.
// Write first, then change the screen: what is shown is what is on disk.
import { version as APP_VERSION } from '../../package.json';
import {
  buildBackupFile,
  buildNotebookExport,
  FORMATS,
  mergeBackup,
  parseFile,
  planItemsImport,
  rejectBuiltinImportedItems,
  type BackupData,
  type BackupFileV1,
  type ImportError,
  type RejectedItem,
} from '../domain/backup.ts';
import { buildClaudePrompt } from '../domain/claudePrompt.ts';
import type { Clock } from '../domain/clock.ts';
import { msUntilNextDay } from '../domain/dates.ts';
import { extractJson } from '../domain/extractJson.ts';
import { hintStageFor } from '../domain/hints.ts';
import { isAccepted } from '../domain/normalize.ts';
import { backupReminderDue, firstAnswerDay } from '../domain/reminders.ts';
import { applyGrade } from '../domain/scheduler.ts';
import { cleanNotebookText, createNotebookEntry, isDuplicateEntry } from '../domain/notebook.ts';
import { countFirstAnswer, currentEntry, emptyCounter, isSessionStale, onFirstAnswer, todayCount } from '../domain/session.ts';
import type { AnswerLog, CardPhase, DailyCounter, DayKey, Flag, Grade, GradedBy, MetaKey, MetaRecord, SessionState, UndoSnapshot } from '../domain/types.ts';
import { createCatalog, withImported, type Catalog } from '../content/catalog.ts';
import { exportFlagsReport, importItems, readBackupData, writeRestore } from '../storage/backupIO.ts';
import { fixedConnection, type AppDb, type DbConnection, type ImportedItem } from '../storage/db.ts';
import { addNotebookEntry, clearSession, commitGrade, loadCounter, putMeta, saveSession, toggleFlag, undoGrade } from '../storage/repo.ts';
import { loadReadyState } from './boot.ts';
import { modeForEntry } from './mode.ts';
import type { AppMeta } from './meta.ts';
import { freshRound, nextCard, poolsOf } from './round.ts';
import type { Action, AppState, ReadyState, Screen } from './state.ts';

/** A file ready to share or download (ui/share.ts). */
export interface ExportFile {
  filename: string;
  text: string;
}

/** `english-pwa-<kind>-YYYY-MM-DD.json` (07 §3.8). */
export function exportFilename(kind: 'backup' | 'notebook' | 'flags', day: string): string {
  return `english-pwa-${kind}-${day}.json`;
}

const toJson = (v: unknown): string => `${JSON.stringify(v, null, 2)}\n`;

export type ImportItemsResult =
  | { status: 'imported'; importedIds: string[]; rejected: RejectedItem[] }
  | { status: 'invalid'; errors: ImportError[] }
  | { status: 'save-failed' }
  /** Another write was in flight; nothing was tried (09 #12). */
  | { status: 'busy' };

/** "Birleştir" (merge, 07 §3.8) or "Tümünü değiştir" (replace, after a second confirmation). */
export type RestoreMode = 'merge' | 'replace';

/** A chosen backup file, validated as a whole before anything is written. */
export type BackupFileCheck = { status: 'valid'; file: BackupFileV1 } | { status: 'invalid'; errors: ImportError[] };

export type RestoreResult = { status: 'restored'; rejected: RejectedItem[] } | { status: 'save-failed' } | { status: 'busy' };

/** Catalog with exactly `imported` as the user's items (after a restore); bundled ids stay reserved. */
function catalogWith(catalog: Catalog, imported: readonly ImportedItem[]): Catalog {
  const c = createCatalog({ contentVersion: catalog.contentVersion, generatedAt: '', items: [...catalog.bundled] }, imported);
  return { ...c, builtinIds: catalog.builtinIds };
}

export interface ActionDeps {
  /** A plain connection, or a reconnecting handle (the app, review 09 #3). */
  db: AppDb | DbConnection;
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
  const conn = 'run' in db ? db : fixedConnection(db);
  const run = <T>(fn: (d: AppDb) => Promise<T>): Promise<T> => conn.run(fn);

  /**
   * Session-only writes (draft, cursor, phase) are write-behind: losing one costs
   * at most a draft, never a grade, so a failure is not surfaced (grades are
   * written atomically in commitGrade).
   */
  function persistSession(session: SessionState | undefined): void {
    void run((d) => (session ? saveSession(d, session) : clearSession(d))).catch(() => undefined);
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
      const base = s.counter.day === session.day ? s.counter : await run((d) => loadCounter(d, session.day));
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
        // Decision 30: practice rows say 'practice'; otherwise the shape that was shown (decision 31).
        mode: entry.kind === ('practice' as string) ? 'practice' : modeForEntry(s, entry, session.cursor),
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
      const logId = await run((d) => commitGrade(d, undo ? { ...commit, undo } : commit));
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

  /**
   * Import items solved in Claude (english-pwa-items), shared by the file
   * picker and the paste box. The whole file is
   * validated first; if invalid nothing is written. Bundled-content ids are
   * rejected and listed; a matching notebookId converts that entry. Items and
   * entries are written in one transaction, then the catalog is updated.
   * With no open round, today's round is rebuilt so the new cards are reachable.
   */
  async function importItemsJson(text: string): Promise<ImportItemsResult> {
    const s = ready(getState);
    if (!s) return { status: 'save-failed' };
    if (s.busy) return { status: 'busy' };
    const parsed = parseFile(text, [FORMATS.items]);
    if (!parsed.ok) return { status: 'invalid', errors: parsed.errors };

    const plan = planItemsImport(parsed.value.file.items, {
      builtinIds: s.catalog.builtinIds,
      notebook: s.notebook,
      now: clock.now(),
    });
    if (plan.items.length === 0) return { status: 'imported', importedIds: [], rejected: plan.rejected };

    dispatch({ type: 'busy' });
    try {
      await run((d) => importItems(d, plan));
    } catch {
      dispatch({ type: 'error', error: 'save-failed' });
      return { status: 'save-failed' };
    }
    const catalog = withImported(s.catalog, plan.items);
    const updates = new Map(plan.notebookUpdates.map((e) => [e.id, e]));
    const notebook = s.notebook.map((e) => updates.get(e.id) ?? e);
    // No open round: build today's round so the new cards come first ("Devam et" on Home); the new-card cap still applies (decision 3).
    // An open round keeps its own day and counter (03 §4.5).
    const today = clock.today();
    const counter = s.session || s.counter.day === today ? s.counter : await run((d) => loadCounter(d, today)).catch(() => emptyCounter(today));
    const session = s.session ?? freshRound({ catalog, progress: s.progress, flags: s.flags }, counter, clock);
    dispatch({ type: 'itemsImported', catalog, notebook, session, counter });
    if (session && !s.session) persistSession(session);
    return { status: 'imported', importedIds: plan.items.map((i) => i.id), rejected: plan.rejected };
  }

  /**
   * Write meta rows, then update the in-memory copy. Meta only drives hints and
   * reminders, so a failed write is not surfaced; resolves false then.
   */
  async function saveMeta(patch: Partial<AppMeta>): Promise<boolean> {
    if (!ready(getState)) return false;
    const records = Object.entries(patch).map(([key, value]) => ({ key: key as MetaKey, value }));
    try {
      await run((d) => putMeta(d, records));
    } catch {
      return false;
    }
    const latest = ready(getState);
    if (latest) dispatch({ type: 'meta', meta: { ...latest.meta, ...patch } });
    return true;
  }

  /**
   * navigator.storage.persist() (T5.5). Must run inside a user tap: the request
   * starts synchronously, the result is stored in meta `persist` when it resolves.
   */
  function requestPersist(): Promise<boolean> {
    const storage = typeof navigator === 'undefined' ? undefined : navigator.storage;
    const ask: Promise<boolean> = storage && typeof storage.persist === 'function' ? storage.persist() : Promise.resolve(false);
    return ask
      .catch(() => false)
      .then(async (granted) => {
        await saveMeta({ persist: granted });
        return granted;
      });
  }

  return {
    startRound,

    /** The injected clock, for UI timers that must agree with the actions (UndoBar, 09 #14). */
    now: (): number => clock.now(),

    // --- First run, persistent storage, hints (Slice 5, T5.5) -----------------

    /**
     * The first "Başla" on this device: ask for persistent storage (inside the
     * tap) and record `firstRunAt`, so the welcome is not shown again. Call
     * before startRound, in the same tap. Does nothing after the first time.
     */
    beginFirstRun(): void {
      const s = ready(getState);
      if (!s || s.meta.firstRunAt !== undefined) return;
      const now = clock.now();
      dispatch({ type: 'meta', meta: { ...s.meta, firstRunAt: now } });
      void requestPersist();
      void run((d) => putMeta(d, [{ key: 'firstRunAt', value: now }])).catch(() => undefined);
    },

    /** Settings → "Kalıcı depolama iste". */
    requestPersist,

    dismissInstallHint(): Promise<boolean> {
      return saveMeta({ installHintDismissed: true });
    },

    /** Home's "Yedeğin 1 haftadan eski" line (decision 27). */
    isBackupReminderDue(): boolean {
      const s = ready(getState);
      if (!s) return false;
      return backupReminderDue({
        now: clock.now(),
        today: clock.today(),
        lastExportAt: s.meta.lastExportAt,
        firstAnswerDay: firstAnswerDay(s.progress.values()),
        dismissedAt: s.meta.backupReminderDismissedAt,
      });
    },

    dismissBackupReminder(): Promise<boolean> {
      return saveMeta({ backupReminderDismissedAt: clock.now() });
    },

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
      const counter = s.counter.day === today ? s.counter : await run((d) => loadCounter(d, today)).catch(() => emptyCounter(today));
      const now = ready(getState);
      if (!now || now.screen !== 'home' || now.session !== s.session) return; // the user moved on meanwhile
      if (stale) persistSession(undefined);
      dispatch({ type: 'day', counter, session: stale ? undefined : s.session, screen: 'home' });
    },

    /** Milliseconds until the next local day, so Home can refresh at midnight while it stays open (09 #7). */
    msUntilNextDay(): number {
      return msUntilNextDay(clock.now());
    },

    /**
     * Card screen, on return to the app (09 #5): a round left open for more than
     * 12 h or built on another day is dropped silently, as on Home, so it never
     * keeps writing into an old day's counter. Continuous use across midnight is
     * not interrupted: this only runs on visibilitychange → visible.
     */
    async dropStaleSession(): Promise<void> {
      const s = ready(getState);
      const session = s?.session;
      const today = clock.today();
      if (!s || !session || s.screen !== 'card' || !isSessionStale(session, today, clock.now())) return;
      const counter = s.counter.day === today ? s.counter : await run((d) => loadCounter(d, today)).catch(() => emptyCounter(today));
      const now = ready(getState);
      if (!now || now.session !== session || now.busy) return; // the user moved on meanwhile
      persistSession(undefined);
      dispatch({ type: 'day', counter, session: undefined, screen: 'home' });
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
        await run((d) => undoGrade(d, snapshot, restored));
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
        const flagged = await run((d) => toggleFlag(d, flag));
        const flags = new Set(s.flags);
        if (flagged) flags.add(entry.itemId);
        else flags.delete(entry.itemId);
        dispatch({ type: 'flags', flags });
      } catch {
        dispatch({ type: 'error', error: 'save-failed' });
      }
    },

    // --- Notebook (Slice 3) -------------------------------------------------

    /**
     * Open the capture sheet. From a card the card's situation becomes the
     * context; the session (incl. draft) is untouched, so closing returns to
     * the same card. Synchronous so the caller can focus in the same tap.
     */
    openNotebook(from: 'card' | 'home'): void {
      const s = ready(getState);
      if (!s) return;
      const entry = from === 'card' && s.session ? currentEntry(s.session) : undefined;
      const item = entry && s.catalog.byId.get(entry.itemId);
      const context = item ? { contextTr: item.situationTr, contextItemId: item.id } : undefined;
      dispatch({ type: 'overlay', overlay: { kind: 'notebook', context } });
    },

    closeNotebook(): void {
      dispatch({ type: 'overlay', overlay: undefined });
    },

    /**
     * Save one entry (IndexedDB only, works offline). A text already in the
     * notebook is saved anyway and flagged in the notice (03 H3.1: never block).
     * Resolves false when the write failed; the sheet then stays open.
     */
    async saveNotebook(text: string): Promise<boolean> {
      const s = ready(getState);
      if (!s || s.busy || s.overlay?.kind !== 'notebook' || cleanNotebookText(text) === '') return false;
      const now = clock.now();
      const entry = createNotebookEntry(text, s.overlay.context, crypto.randomUUID(), now);
      const duplicate = isDuplicateEntry(entry.textTr, s.notebook);
      dispatch({ type: 'busy' });
      try {
        await run((d) => addNotebookEntry(d, entry));
        dispatch({ type: 'notebookAdded', entry, notice: { kind: 'notebook-saved', duplicate, at: now } });
        return true;
      } catch {
        dispatch({ type: 'error', error: 'save-failed' });
        return false;
      }
    },

    // --- Settings: export (Slice 3, T3.3) ------------------------------------

    openSettings(): void {
      dispatch({ type: 'screen', screen: 'settings' });
    },

    /** Back from Settings: Settings opens from Home only, so back to Home ("Devam et" if a round is open). */
    closeSettings(): void {
      dispatch({ type: 'screen', screen: 'home' });
    },

    /**
     * Notebook export for solving in Claude: open entries only. Built from
     * memory without awaiting, so the share sheet still opens inside the tap.
     */
    exportNotebook(): ExportFile | undefined {
      const s = ready(getState);
      if (!s) return undefined;
      const file = buildNotebookExport(s.notebook, clock.now());
      return { filename: exportFilename('notebook', clock.today()), text: toJson(file) };
    },

    /**
     * "Claude'a yapıştır": the notebook export as a prompt for claude.ai.
     * Synchronous like exportNotebook, so the clipboard write stays inside the tap.
     * undefined when nothing is open.
     */
    claudePrompt(): string | undefined {
      const s = ready(getState);
      if (!s || !s.notebook.some((e) => e.status === 'open')) return undefined;
      return buildClaudePrompt(s.notebook, new Date(clock.now()).toISOString());
    },

    /** Flags report for content review (decision 12). */
    async exportFlags(): Promise<ExportFile | undefined> {
      const s = ready(getState);
      if (!s) return undefined;
      const report = await run((d) => exportFlagsReport(d, s.catalog.byId, s.catalog.contentVersion, clock.now()));
      return { filename: exportFilename('flags', clock.today()), text: toJson(report) };
    },

    // --- Settings: items import (Slice 3, T3.4) -------------------------------

    /** "Item dosyası seç": the picked file's text. */
    importItemsFile(text: string): Promise<ImportItemsResult> {
      return importItemsJson(text);
    },

    /** "JSON'u yapıştır": Claude's reply as copied from claude.ai; the first ```json block is taken (extractJson). */
    importItemsPaste(text: string): Promise<ImportItemsResult> {
      return importItemsJson(extractJson(text));
    },

    // --- Settings: full backup (Slice 5, T5.4) --------------------------------

    /**
     * The full backup file, read from IndexedDB. Settings prepares it ahead of
     * the tap so the share sheet opens inside the user gesture (iOS).
     */
    async prepareBackup(): Promise<ExportFile | undefined> {
      const s = ready(getState);
      if (!s) return undefined;
      const data = await run(readBackupData);
      const file = buildBackupFile(data, { now: clock.now(), appVersion: APP_VERSION, contentVersion: s.catalog.contentVersion });
      return { filename: exportFilename('backup', clock.today()), text: toJson(file) };
    },

    /** The backup reached the share sheet or a download: remember when (meta `lastExportAt`). */
    async markBackupExported(): Promise<void> {
      // On failure the file itself was still handed over; only the reminder date is lost.
      await saveMeta({ lastExportAt: clock.now() });
    },

    /** Validate a chosen backup file; nothing is written here. */
    checkBackupFile(text: string): BackupFileCheck {
      const parsed = parseFile(text, [FORMATS.backup]);
      return parsed.ok ? { status: 'valid', file: parsed.value.file } : { status: 'invalid', errors: parsed.errors };
    },

    /**
     * Restore a validated backup. "Birleştir" merges per store (mergeBackup);
     * "Tümünü değiştir" makes the file's data the whole data and drops the open
     * round. Imported items with a bundled id are rejected either way. One
     * transaction; afterwards the whole in-memory state is reloaded from disk.
     */
    async restoreBackup(file: BackupFileV1, mode: RestoreMode): Promise<RestoreResult> {
      const s = ready(getState);
      if (!s) return { status: 'save-failed' };
      if (s.busy) return { status: 'busy' };
      dispatch({ type: 'busy' });
      try {
        let data: BackupData;
        let rejected: RejectedItem[];
        if (mode === 'merge') {
          const merged = mergeBackup(await run(readBackupData), file.data, s.catalog.builtinIds);
          data = merged.data;
          rejected = merged.rejectedImportedItems;
        } else {
          const allowed = rejectBuiltinImportedItems(file.data.importedItems, s.catalog.builtinIds);
          data = { ...file.data, importedItems: allowed.items };
          rejected = allowed.rejected;
        }
        // A restore counts as the first run: the welcome is not shown again.
        const meta: MetaRecord[] = s.meta.firstRunAt === undefined ? [{ key: 'firstRunAt', value: clock.now() }] : [];
        await run((d) => writeRestore(d, { data, clearSession: mode === 'replace', meta }));
        const latest = ready(getState) ?? s;
        const state = await run((d) => loadReadyState(d, (imported) => catalogWith(s.catalog, imported), clock, latest.screen));
        dispatch({ type: 'restored', state });
        return { status: 'restored', rejected };
      } catch {
        dispatch({ type: 'error', error: 'save-failed' });
        return { status: 'save-failed' };
      }
    },

    dismissNotice(): void {
      dispatch({ type: 'notice', notice: undefined });
    },

    dismissError(): void {
      dispatch({ type: 'clearError' });
    },
  };
}

export type Actions = ReturnType<typeof createActions>;
