import { describe, expect, it } from 'vitest';
import {
  buildBackupFile,
  buildFlagsReport,
  buildNotebookExport,
  detectFormat,
  formatPath,
  mergeBackup,
  parseFile,
  planItemsImport,
  rejectBuiltinImportedItems,
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

  it('accepts boxes 6 and 7 and lastPracticedAt on progress (decisions 39, 41); rejects box 8', () => {
    const ok = backupFile() as unknown as { data: { progress: unknown[] } };
    ok.data.progress = [progress('a', { box: 6 }), progress('b', { box: 7, lastPracticedAt: 12345 })];
    const r = parseFile(ok, ['english-pwa-backup']);
    expect(r.ok && (r.value.file as { data: { progress: Progress[] } }).data.progress.map((p) => [p.box, p.lastPracticedAt])).toEqual([[6, undefined], [7, 12345]]);
    ok.data.progress = [{ ...progress('a'), box: 8 }];
    expect(parseFile(ok, ['english-pwa-backup']).ok).toBe(false);
  });

  it('answer-log rows: old ones with hintStage, new ones with hintUsed and no hintStage (decision 35)', () => {
    const file = backupFile() as unknown as { data: { answerLog: Record<string, unknown>[] } };
    const base = { at: 1, day: '2026-11-02', itemId: 'a', answer: '', grade: 'partial', gradedBy: 'auto', isRepeat: false, boxBefore: 3, boxAfter: 3 };
    file.data.answerLog = [{ ...base, hintStage: 2 }, { ...base, hintUsed: 2 }];
    expect(parseFile(file, ['english-pwa-backup']).ok).toBe(true);
    file.data.answerLog = [{ ...base, hintUsed: 3 }];
    expect(parseFile(file, ['english-pwa-backup']).ok).toBe(false);
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

describe('mergeBackup (07 §3.8 merge table)', () => {
  const builtin = new Set(['could-you-base-verb']);
  const merge = (local: Partial<BackupData>, incoming: Partial<BackupData>) =>
    mergeBackup(data(local), data(incoming), builtin);

  describe('progress', () => {
    it('later lastAnsweredOn wins (incoming newer)', () => {
      const inc = progress('a', { lastAnsweredOn: '2026-11-03', box: 3, updatedAt: 1 });
      const r = merge({ progress: [progress('a')] }, { progress: [inc] });
      expect(r.data.progress).toEqual([inc]);
    });
    it('later lastAnsweredOn wins (local newer, despite older updatedAt)', () => {
      const loc = progress('a', { lastAnsweredOn: '2026-11-03', updatedAt: 1 });
      const r = merge({ progress: [loc] }, { progress: [progress('a', { updatedAt: 9999 })] });
      expect(r.data.progress).toEqual([loc]);
    });
    it('compares days as calendar days across a month boundary', () => {
      const inc = progress('a', { lastAnsweredOn: '2026-12-01' });
      const r = merge({ progress: [progress('a', { lastAnsweredOn: '2026-11-30' })] }, { progress: [inc] });
      expect(r.data.progress).toEqual([inc]);
    });
    it('same lastAnsweredOn → later updatedAt wins', () => {
      const inc = progress('a', { updatedAt: 2000, box: 4 });
      expect(merge({ progress: [progress('a')] }, { progress: [inc] }).data.progress).toEqual([inc]);
      const loc = progress('a', { updatedAt: 3000, box: 1 });
      expect(merge({ progress: [loc] }, { progress: [inc] }).data.progress).toEqual([loc]);
    });
    it('full tie → local stays', () => {
      const loc = progress('a', { box: 1 });
      const r = merge({ progress: [loc] }, { progress: [progress('a', { box: 5 })] });
      expect(r.data.progress).toEqual([loc]);
    });
    it('different items are all kept', () => {
      const r = merge({ progress: [progress('a')] }, { progress: [progress('b')] });
      expect(r.data.progress.map((p) => p.itemId)).toEqual(['a', 'b']);
    });
  });

  describe('dailyCounters', () => {
    it('same day → the larger value of each field', () => {
      const r = merge(
        { dailyCounters: [counter('2026-11-02', 5, 2)] },
        { dailyCounters: [counter('2026-11-02', 3, 9)] },
      );
      expect(r.data.dailyCounters).toEqual([counter('2026-11-02', 5, 9)]);
    });
    it('different days are all kept', () => {
      const r = merge(
        { dailyCounters: [counter('2026-11-02', 1, 1)] },
        { dailyCounters: [counter('2026-11-01', 2, 2)] },
      );
      expect(r.data.dailyCounters).toEqual([counter('2026-11-02', 1, 1), counter('2026-11-01', 2, 2)]);
    });
  });

  describe('notebook', () => {
    it('same id → local stays', () => {
      const loc = entry('n1', { status: 'open', textTr: 'yerel' });
      const r = merge({ notebook: [loc] }, { notebook: [entry('n1', { status: 'converted', textTr: 'gelen' })] });
      expect(r.data.notebook).toEqual([loc]);
    });
    it('different ids are all kept', () => {
      const r = merge({ notebook: [entry('n1')] }, { notebook: [entry('n2'), entry('n3')] });
      expect(r.data.notebook.map((e) => e.id)).toEqual(['n1', 'n2', 'n3']);
    });
  });

  describe('flags', () => {
    it('union by itemId', () => {
      const r = merge({ flags: [flag('a')] }, { flags: [flag('b')] });
      expect(r.data.flags.map((f) => f.itemId)).toEqual(['a', 'b']);
    });
    it('collision → local stays (one record per item)', () => {
      const loc = flag('a', { flaggedAt: 1, screen: 'result' });
      const r = merge({ flags: [loc] }, { flags: [flag('a', { flaggedAt: 2 })] });
      expect(r.data.flags).toEqual([loc]);
    });
  });

  describe('answerLog', () => {
    it('deduplicates by (at, itemId); local rows keep their id', () => {
      const loc = log('a', 10, { id: 1 });
      const r = merge({ answerLog: [loc] }, { answerLog: [log('a', 10, { id: 55, answer: 'other' })] });
      expect(r.data.answerLog).toEqual([loc]);
    });
    it('same at but different item, or same item at a different time, are distinct', () => {
      const r = merge({ answerLog: [log('a', 10, { id: 1 })] }, { answerLog: [log('b', 10), log('a', 11)] });
      expect(r.data.answerLog.map((l) => [l.itemId, l.at])).toEqual([
        ['a', 10],
        ['b', 10],
        ['a', 11],
      ]);
    });
    it('new incoming rows lose their id so a fresh one is generated', () => {
      const r = merge({ answerLog: [log('a', 10, { id: 1 })] }, { answerLog: [log('b', 20, { id: 1 })] });
      expect(r.data.answerLog[1]).toEqual(log('b', 20));
      expect(r.data.answerLog[1]).not.toHaveProperty('id');
    });
    it('duplicates inside the incoming file collapse to one', () => {
      const r = merge({}, { answerLog: [log('a', 10, { id: 3 }), log('a', 10, { id: 4 })] });
      expect(r.data.answerLog).toEqual([log('a', 10)]);
    });
    it('does not touch local rows, even a local duplicate', () => {
      const local = [log('a', 10, { id: 1 }), log('a', 10, { id: 2 })];
      expect(merge({ answerLog: local }, {}).data.answerLog).toEqual(local);
    });
  });

  describe('importedItems', () => {
    it('incoming id colliding with bundled content is rejected and listed', () => {
      const r = merge({}, { importedItems: [imported('could-you-base-verb'), imported('u1')] });
      expect(r.rejectedImportedItems).toEqual([{ id: 'could-you-base-verb', reason: 'builtin-id' }]);
      expect(r.data.importedItems.map((i) => i.id)).toEqual(['u1']);
    });
    it('same id locally → local stays', () => {
      const loc = imported('u1', 100);
      const r = merge({ importedItems: [loc] }, { importedItems: [imported('u1', 200)] });
      expect(r.data.importedItems).toEqual([loc]);
      expect(r.rejectedImportedItems).toEqual([]);
    });
  });

  it('merging with an empty backup returns local unchanged; into empty returns incoming', () => {
    const full = fullData();
    expect(mergeBackup(full, data(), builtin)).toEqual({ data: full, rejectedImportedItems: [] });
    const r = mergeBackup(data(), full, builtin);
    expect(r.data).toEqual({ ...full, answerLog: full.answerLog.map(stripId) });
  });

  it('does not mutate its inputs', () => {
    const local = fullData();
    const incoming = data({ answerLog: [log('z', 99, { id: 9 })], progress: [progress('a', { updatedAt: 5000 })] });
    const before = structuredClone({ local, incoming });
    mergeBackup(local, incoming, builtin);
    expect({ local, incoming }).toEqual(before);
  });
});

describe('rejectBuiltinImportedItems ("Tümünü değiştir")', () => {
  it('splits bundled-id collisions from the rest', () => {
    const r = rejectBuiltinImportedItems([imported('u1'), imported('could-you-base-verb')], new Set(['could-you-base-verb']));
    expect(r.items.map((i) => i.id)).toEqual(['u1']);
    expect(r.rejected).toEqual([{ id: 'could-you-base-verb', reason: 'builtin-id' }]);
  });
});

function stripId(l: AnswerLog): AnswerLog {
  const copy = { ...l };
  delete copy.id;
  return copy;
}

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
