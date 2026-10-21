import { describe, expect, it } from 'vitest';
import {
  buildBackupFile,
  buildFlagsReport,
  buildNotebookExport,
  detectFormat,
  formatPath,
  parseFile,
  planItemsImport,
  USER_IMPORT,
  type BackupData,
  type ImportedItem,
} from './backup.ts';
import type { AnswerLog, DailyCounter, Flag, Item, NotebookEntry, Progress } from './types.ts';

const NOW = Date.UTC(2026, 10, 2, 8, 0, 0);

const item = (id: string, extra: Partial<Item> = {}): Item => ({
  id,
  category: 'aux_to',
  level: 1,
  targetChunk: 'can / could + base verb',
  clozeTemplate: 'Could you ___ the logs?',
  situationTr: 'Mert’e yazıyorsun.',
  acceptedAnswers: ['Could you check the logs?'],
  modelSentences: ['Could you check the logs?'],
  checklistTr: ['to koymadın, değil mi?'],
  noteTr: 'Not.',
  source: 'curated',
  verified: true,
  verifiedNote: 'ok',
  ...extra,
});

/** An item as Claude would return it: no source/verified/verifiedNote. */
const incomingItem = (id: string, extra: Record<string, unknown> = {}) => {
  const raw: Record<string, unknown> = { ...item(id) };
  delete raw.source;
  delete raw.verified;
  delete raw.verifiedNote;
  return { ...raw, ...extra };
};

const progress = (itemId: string, extra: Partial<Progress> = {}): Progress => ({
  itemId,
  box: 2,
  dueOn: '2026-11-04',
  introducedOn: '2026-11-01',
  lastAnsweredOn: '2026-11-02',
  lastGrade: 'correct',
  updatedAt: 1000,
  ...extra,
});
const counter = (day: string, newIntroduced: number, reviewsAnswered: number): DailyCounter => ({
  day,
  newIntroduced,
  reviewsAnswered,
});
const entry = (id: string, extra: Partial<NotebookEntry> = {}): NotebookEntry => ({
  id,
  textTr: `metin ${id}`,
  createdAt: 100,
  status: 'open',
  ...extra,
});
const flag = (itemId: string, extra: Partial<Flag> = {}): Flag => ({
  itemId,
  flaggedAt: 500,
  screen: 'question',
  contentVersion: 'abc123def456',
  ...extra,
});
const log = (itemId: string, at: number, extra: Partial<AnswerLog> = {}): AnswerLog => ({
  at,
  day: '2026-11-02',
  itemId,
  answer: 'Could you check the logs?',
  grade: 'correct',
  gradedBy: 'auto',
  hintStage: 1,
  isRepeat: false,
  boxBefore: null,
  boxAfter: 2,
  ...extra,
});
const imported = (id: string, importedAt = 900): ImportedItem => ({ ...item(id), ...USER_IMPORT, importedAt });

const data = (extra: Partial<BackupData> = {}): BackupData => ({
  progress: [],
  dailyCounters: [],
  notebook: [],
  flags: [],
  answerLog: [],
  importedItems: [],
  ...extra,
});

const fullData = (): BackupData =>
  data({
    progress: [progress('a')],
    dailyCounters: [counter('2026-11-02', 3, 4)],
    notebook: [entry('n1', { contextTr: 'bağlam', contextItemId: 'a' })],
    flags: [flag('a', { userAnswer: 'x' })],
    answerLog: [log('a', 1, { id: 7 })],
    importedItems: [imported('u1')],
  });

const backupFile = () => buildBackupFile(fullData(), { now: NOW, appVersion: '0.0.0', contentVersion: 'abc123def456' });

describe('format detection', () => {
  it.each([
    ['english-pwa-backup'],
    ['english-pwa-notebook'],
    ['english-pwa-items'],
    ['english-pwa-flags'],
  ])('recognises %s', (format) => {
    expect(detectFormat({ format })).toBe(format);
  });
  it.each([[null], [[]], ['str'], [{}], [{ format: 'other' }], [{ format: 1 }]])('returns null for %j', (input) => {
    expect(detectFormat(input)).toBeNull();
  });
});

describe('parseFile', () => {
  it('accepts a valid V1 backup from text and returns it unchanged', () => {
    const file = backupFile();
    const r = parseFile(JSON.stringify(file), ['english-pwa-backup']);
    expect(r).toEqual({ ok: true, value: { format: 'english-pwa-backup', file } });
  });
  it('accepts already-parsed JSON', () => {
    expect(parseFile(backupFile(), ['english-pwa-backup']).ok).toBe(true);
  });
  it('rejects invalid JSON', () => {
    const r = parseFile('{ not json', ['english-pwa-backup']);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toEqual([expect.objectContaining({ code: 'invalid-json', path: '' })]);
  });
  it('rejects an unknown format', () => {
    const r = parseFile({ format: 'something', schemaVersion: 1 }, ['english-pwa-backup']);
    expect(r).toEqual({ ok: false, errors: [expect.objectContaining({ code: 'unknown-format', path: 'format' })] });
  });
  it('rejects a known format the screen does not accept', () => {
    const r = parseFile(buildNotebookExport([], NOW), ['english-pwa-items']);
    expect(r).toEqual({ ok: false, errors: [expect.objectContaining({ code: 'wrong-format', path: 'format' })] });
  });
  it('accepts any format in the accept list', () => {
    const r = parseFile(buildNotebookExport([], NOW), ['english-pwa-backup', 'english-pwa-notebook']);
    expect(r.ok && r.value.format).toBe('english-pwa-notebook');
  });
  it('rejects schemaVersion 2 as unsupported', () => {
    const r = parseFile({ ...backupFile(), schemaVersion: 2 }, ['english-pwa-backup']);
    expect(r).toEqual({
      ok: false,
      errors: [expect.objectContaining({ code: 'unsupported-version', path: 'schemaVersion' })],
    });
  });
  it.each([[0], ['1'], [undefined]])('rejects schemaVersion %j as invalid', (schemaVersion) => {
    const r = parseFile({ ...backupFile(), schemaVersion }, ['english-pwa-backup']);
    expect(r).toEqual({ ok: false, errors: [expect.objectContaining({ code: 'invalid', path: 'schemaVersion' })] });
  });

  it('lists every problem with its path', () => {
    const file = backupFile() as unknown as { data: Record<string, unknown[]> };
    const bad = structuredClone(file) as { data: Record<string, Record<string, unknown>[]> };
    delete bad.data.progress![0]!.box;
    bad.data.dailyCounters![0]!.day = '2026-02-30';
    bad.data.importedItems![0]!.level = 4;
    delete bad.data.flags;
    const r = parseFile(bad, ['english-pwa-backup']);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.every((e) => e.code === 'invalid')).toBe(true);
    expect(r.errors.map((e) => e.path).sort()).toEqual(
      ['data.dailyCounters[0].day', 'data.flags', 'data.importedItems[0].level', 'data.progress[0].box'].sort(),
    );
  });
  it('reports missing top-level fields', () => {
    const r = parseFile({ format: 'english-pwa-backup', schemaVersion: 1 }, ['english-pwa-backup']);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.map((e) => e.path).sort()).toEqual(['appVersion', 'contentVersion', 'data', 'exportedAt']);
    }
  });
  it('requires importedAt on backup importedItems', () => {
    const file = structuredClone(backupFile()) as { data: { importedItems: Record<string, unknown>[] } };
    delete file.data.importedItems[0]!.importedAt;
    const r = parseFile(file, ['english-pwa-backup']);
    expect(!r.ok && r.errors.map((e) => e.path)).toEqual(['data.importedItems[0].importedAt']);
  });

  describe('items import (decision 14)', () => {
    const itemsFile = (items: unknown[]) => ({ format: 'english-pwa-items', schemaVersion: 1, items });

    it('fills source/verified/verifiedNote when absent', () => {
      const r = parseFile(itemsFile([incomingItem('u1', { notebookId: 'n1' })]), ['english-pwa-items']);
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.value.file.items).toEqual([
          { ...item('u1'), source: 'user-error', verified: true, verifiedNote: 'user-import', notebookId: 'n1' },
        ]);
      }
    });
    it('overwrites source/verified/verifiedNote when the file sets them', () => {
      const raw = incomingItem('u1', { source: 'curated', verified: false, verifiedNote: 'claimed by Claude' });
      const r = parseFile(itemsFile([raw]), ['english-pwa-items']);
      expect(r.ok && r.value.file.items[0]).toMatchObject(USER_IMPORT);
    });
    it('reports item errors with their path', () => {
      const r = parseFile(itemsFile([incomingItem('u1'), incomingItem('Bad_Id', { typo: 1 })]), ['english-pwa-items']);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors.map((e) => e.path).sort()).toEqual(['items[1]', 'items[1].id']);
    });
    it('rejects an empty items list', () => {
      const r = parseFile(itemsFile([]), ['english-pwa-items']);
      expect(!r.ok && r.errors[0]?.path).toBe('items');
    });
  });
});

describe('builders', () => {
  it('backup file round-trips and carries meta', () => {
    const file = backupFile();
    expect(file).toMatchObject({
      format: 'english-pwa-backup',
      schemaVersion: 1,
      exportedAt: '2026-11-02T08:00:00.000Z',
      appVersion: '0.0.0',
      contentVersion: 'abc123def456',
    });
    expect(parseFile(file, ['english-pwa-backup'])).toEqual({ ok: true, value: { format: file.format, file } });
  });

  it('notebook export holds only open entries, oldest first, without internal fields', () => {
    const file = buildNotebookExport(
      [
        entry('late', { createdAt: 300 }),
        entry('done', { status: 'converted', convertedItemId: 'u1' }),
        entry('early', { createdAt: 50, contextTr: 'kart bağlamı', contextItemId: 'a' }),
      ],
      NOW,
    );
    expect(file.entries).toEqual([
      { id: 'early', textTr: 'metin early', contextTr: 'kart bağlamı' },
      { id: 'late', textTr: 'metin late' },
    ]);
    expect(parseFile(file, ['english-pwa-notebook']).ok).toBe(true);
  });

  it('flags report joins item fields; unknown item gets empty strings', () => {
    const file = buildFlagsReport([flag('a'), flag('gone')], new Map([['a', item('a')]]), 'abc123def456', NOW);
    expect(file.flags).toEqual([
      { ...flag('a'), targetChunk: 'can / could + base verb', situationTr: 'Mert’e yazıyorsun.', canonical: 'Could you check the logs?' },
      { ...flag('gone'), targetChunk: '', situationTr: '', canonical: '' },
    ]);
    expect(parseFile(file, ['english-pwa-flags']).ok).toBe(true);
  });
});

describe('planItemsImport', () => {
  const ctx = {
    builtinIds: new Set(['could-you-base-verb']),
    notebook: [entry('n1'), entry('n2')],
    now: NOW,
  };

  it('rejects ids that collide with bundled content and lists them', () => {
    const plan = planItemsImport([item('could-you-base-verb'), item('u1')], ctx);
    expect(plan.rejected).toEqual([{ id: 'could-you-base-verb', reason: 'builtin-id' }]);
    expect(plan.items.map((i) => i.id)).toEqual(['u1']);
  });
  it('keeps the first of duplicate ids in one file', () => {
    const plan = planItemsImport([item('u1', { level: 1 }), item('u1', { level: 2 })], ctx);
    expect(plan.items).toHaveLength(1);
    expect(plan.items[0]?.level).toBe(1);
    expect(plan.rejected).toEqual([{ id: 'u1', reason: 'duplicate-in-file' }]);
  });
  it('stamps decision 14 fields and importedAt', () => {
    const plan = planItemsImport([item('u1')], ctx);
    expect(plan.items[0]).toEqual({ ...item('u1'), ...USER_IMPORT, importedAt: NOW });
  });
  it('converts the notebook entry named by notebookId', () => {
    const plan = planItemsImport([item('u1', { notebookId: 'n2' }), item('u2', { notebookId: 'missing' })], ctx);
    expect(plan.notebookUpdates).toEqual([{ ...entry('n2'), status: 'converted', convertedItemId: 'u1' }]);
  });
  it('does not convert an entry for a rejected item', () => {
    const plan = planItemsImport([item('could-you-base-verb', { notebookId: 'n1' })], ctx);
    expect(plan.notebookUpdates).toEqual([]);
  });
});

describe('formatPath', () => {
  it.each([
    [[], ''],
    [['format'], 'format'],
    [['data', 'progress', 3, 'box'], 'data.progress[3].box'],
    [['items', 0], 'items[0]'],
  ] as const)('%j → %s', (path, out) => {
    expect(formatPath(path)).toBe(out);
  });
});
