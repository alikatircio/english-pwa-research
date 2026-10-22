// Domain types (07 §3.1, §3.2). Pure: no React, no IDB, no DOM.

export type Category = 'aux_to' | 'object' | 'word_form' | 'preposition' | 'work_vocab';
export type Grade = 'correct' | 'partial' | 'wrong';
export type GradedBy = 'auto' | 'self';
export type Box = 1 | 2 | 3 | 4 | 5;
export type HintStage = 1 | 2 | 3;
/** Device-local calendar day, 'YYYY-MM-DD'. No time component (03 §4.5). */
export type DayKey = string;

/** Final schema from 06, unchanged. */
export type Item = {
  id: string;
  category: Category;
  targetChunk: string;
  patternSlots?: string;
  clozeTemplate: string;
  situationTr: string;
  acceptedAnswers: string[];
  modelSentences: string[];
  /** Decision 42: aligned with modelSentences[1..]; the sentence with critical words replaced by "___", or null. */
  modelBlanks?: (string | null)[];
  commonMistake?: string;
  checklistTr: string[];
  noteTr: string;
  source: 'curated' | 'user-error';
  verified: boolean;
  verifiedNote?: string;
  level: 1 | 2 | 3;
  notebookId?: string;
};

/** `importedItems` store row (Slice 3): an Item plus when it was imported. */
export type ImportedItem = Item & { importedAt: number };

/** Bundled content file (src/content/items.json). */
export interface ContentBundle {
  /** First 12 hex chars of the sha256 of the canonical JSON. */
  contentVersion: string;
  /** ISO timestamp. */
  generatedAt: string;
  /** verified:true only. */
  items: Item[];
}

/** No record means the card is new. */
export interface Progress {
  itemId: string;
  box: Box;
  dueOn: DayKey;
  /** Day of the first answer. */
  introducedOn: DayKey;
  lastAnsweredOn: DayKey;
  lastGrade: Grade;
  /** Epoch ms; tie-breaker when merging imports. */
  updatedAt: number;
}

export interface DailyCounter {
  day: DayKey;
  newIntroduced: number;
  reviewsAnswered: number;
}

export interface NotebookEntry {
  id: string;
  textTr: string;
  contextTr?: string;
  contextItemId?: string;
  createdAt: number;
  status: 'open' | 'converted';
  convertedItemId?: string;
}

export interface Flag {
  itemId: string;
  flaggedAt: number;
  screen: 'question' | 'result';
  userAnswer?: string;
  contentVersion: string;
}

/** Decision 13: hidden answer log; never shown in the UI, export only. */
export interface AnswerLog {
  id?: number;
  at: number;
  day: DayKey;
  itemId: string;
  /** Raw text the user typed. */
  answer: string;
  grade: Grade;
  gradedBy: GradedBy;
  hintStage: HintStage;
  /** End-of-round repeat (decision 5: does not change the box). */
  isRepeat: boolean;
  /** null = new card. */
  boxBefore: Box | null;
  boxAfter: Box | null;
}

export type QueueKind = 'due' | 'new' | 'repeat';
export interface QueueEntry {
  itemId: string;
  kind: QueueKind;
}

export type CardPhase =
  | { tag: 'question' }
  | { tag: 'result'; answer: string; matched: true }
  | { tag: 'result'; answer: string; matched: false; grade?: Grade };

/** Session fields onFirstAnswer may change (repeat append, wrong streak, breather reorder, summary). */
export type RoundFields = Pick<SessionState, 'queue' | 'repeatQueued' | 'consecutiveWrong' | 'studiedChunks'>;

export interface UndoSnapshot {
  itemId: string;
  prevProgress: Progress | null;
  prevCounter: DailyCounter;
  /** Round fields before the grade: undo reverts the onFirstAnswer effects too. */
  prevRound: RoundFields;
  logId: number;
  expiresAt: number;
}

export interface SessionState {
  key: 'current';
  /** Day the round was built (queue is pinned to that day). */
  day: DayKey;
  startedAt: number;
  /** Older than 12 h or a different day → silently discarded. */
  updatedAt: number;
  queue: QueueEntry[];
  cursor: number;
  phase: CardPhase;
  draft: string;
  repeatQueued: string[];
  consecutiveWrong: number;
  studiedChunks: string[];
  undo?: UndoSnapshot;
}

export type MetaKey =
  | 'firstRunAt'
  | 'lastExportAt'
  | 'persist'
  | 'installHintDismissed'
  | 'eveningPrompt'
  /** "Yedeğin 1 haftadan eski" dismissed at (epoch ms); hidden for 7 days (decision 27). */
  | 'backupReminderDismissedAt';
export interface MetaRecord {
  key: MetaKey;
  value: unknown;
}
