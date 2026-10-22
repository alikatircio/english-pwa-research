// Domain types (07 §3.1, §3.2). Pure: no React, no IDB, no DOM.

export type Category = 'aux_to' | 'object' | 'word_form' | 'preposition' | 'work_vocab';
export type Grade = 'correct' | 'partial' | 'wrong';
export type GradedBy = 'auto' | 'self';
export type Box = 1 | 2 | 3 | 4 | 5 | 6 | 7;
/** Legacy auto stage (decision 4, removed by decision 35); only old log rows carry it. */
export type HintStage = 1 | 2 | 3;
/** Decision 35: on-demand hint level. 1 = cloze, 2 = cloze + initials of the chunk. */
export type HintLevel = 1 | 2;
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
  /** Graded main showings so far (decision 31 mode rotation). Absent on older records: counts as 1. */
  shows?: number;
  /** Epoch ms of the last free-practice answer (decision 41). Practice never touches the box or counters. */
  lastPracticedAt?: number;
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
  /** Old rows only (decision 4: automatic stage by box). */
  hintStage?: HintStage;
  /** Decision 35: highest hint level the user asked for on this card (0 = none). */
  hintUsed?: 0 | HintLevel;
  /** End-of-round repeat (decision 5: does not change the box). */
  isRepeat: boolean;
  /** null = new card. */
  boxBefore: Box | null;
  boxAfter: Box | null;
  /** Exercise shape shown (decision 31); 'practice' for free practice (decision 30). Absent on older rows. */
  mode?: 'write' | 'fix' | 'order' | 'practice';
}

/** 'practice' = decision 30 free practice: never touches progress or the daily counters. */
export type QueueKind = 'due' | 'new' | 'repeat' | 'practice';
export interface QueueEntry {
  itemId: string;
  kind: QueueKind;
}

/** Exercise shape (decisions 31, 36, 37). */
export type ExerciseMode = 'write' | 'fix' | 'order';

/**
 * `mode` = the shape the question had, `boxBefore` = the card's box before this
 * showing (null = new); both are kept for the result (log, fix note, commonMistake rule).
 * `hinted` = a correct answer that counted as partial because a hint was used (decision 35).
 */
export type CardPhase =
  /** Decision 33: a new card's first look at the pattern, before "Hazırım" hides it. */
  | { tag: 'study' }
  | { tag: 'question' }
  | { tag: 'result'; answer: string; matched: true; mode?: ExerciseMode; boxBefore?: Box | null; hinted?: boolean }
  | { tag: 'result'; answer: string; matched: false; grade?: Grade; mode?: ExerciseMode; boxBefore?: Box | null; hinted?: boolean };

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
  /** Decision 35: hint level opened on the current card; cleared when the card changes. */
  hint?: HintLevel;
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
  | 'backupReminderDismissedAt'
  /** Daily new-card cap, 5 / 10 / 15 / 20 (decision 29). */
  | 'dailyNewCap'
  /** Notebook sheet's "Nasıl kullanılır" box closed for good (decision 32). */
  | 'notebookHelpDismissed';
export interface MetaRecord {
  key: MetaKey;
  value: unknown;
}
