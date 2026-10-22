// Notebook + items import through the action layer (store + fake-indexeddb).
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import fixture from '../../content/fixtures/e2e-items.json';
import { fixedClock } from '../domain/clock.ts';
import type { ContentBundle, Item } from '../domain/types.ts';
import { openAppDb } from '../storage/db.ts';
import { loadAll } from '../storage/repo.ts';
import { createActions } from './actions.ts';
import { boot } from './boot.ts';
import type { ReadyState } from './state.ts';
import { createStore } from './store.ts';

const bundle = fixture as ContentBundle;
const clock = fixedClock(new Date(2026, 10, 2, 8).getTime());

async function setup() {
  const name = `actions-${Math.random()}`;
  const { db, state } = await boot({ bundle, clock, openDb: () => openAppDb({ name }) });
  const store = createStore();
  store.dispatch({ type: 'booted', state });
  const actions = createActions({ db, clock, getState: store.getState, dispatch: store.dispatch });
  actions.startRound(); // "Başla" on Home
  const ready = () => store.getState() as ReadyState;
  return { db, actions, ready };
}

const solved = (id: string, notebookId?: string) => {
  // Claude's file carries no source/verified/verifiedNote (07 §3.8).
  const rest: Partial<Item> = { ...(bundle.items[0] as Item) };
  delete rest.source;
  delete rest.verified;
  delete rest.verifiedNote;
  return { ...rest, id, ...(notebookId ? { notebookId } : {}) };
};
const itemsFile = (items: unknown[]) => JSON.stringify({ format: 'english-pwa-items', schemaVersion: 1, items });

describe('notebook capture', () => {
  it('saves mid-card with the card as context, keeps the session, and warns on a duplicate', async () => {
    const { db, actions, ready } = await setup();
    actions.saveDraft(0, 'I will se');
    const sessionBefore = ready().session;

    actions.openNotebook('card');
    expect(ready().overlay).toEqual({ kind: 'notebook', context: { contextTr: bundle.items[0]?.situationTr, contextItemId: bundle.items[0]?.id } });
    expect(await actions.saveNotebook('  ')).toBe(false);
    expect(await actions.saveNotebook('sorunu ekibe yükseltmek')).toBe(true);
    expect(ready().overlay).toBeUndefined();
    expect(ready().notice).toMatchObject({ kind: 'notebook-saved', duplicate: false });
    expect(ready().session).toBe(sessionBefore);
    expect(ready().session?.draft).toBe('I will se');

    actions.openNotebook('home');
    expect(ready().overlay).toEqual({ kind: 'notebook', context: undefined });
    await actions.saveNotebook('Sorunu ekibe yükseltmek.');
    expect(ready().notice?.duplicate).toBe(true);
    expect((await loadAll(db, '2026-11-02')).notebook).toHaveLength(2);
    db.close();
  });
});

describe("Claude'a yapıştır prompt", () => {
  it('undefined with nothing open; after a capture it lists the entry with its context', async () => {
    const { db, actions, ready } = await setup();
    expect(actions.claudePrompt()).toBeUndefined();

    actions.openNotebook('card');
    await actions.saveNotebook('sorunu ekibe yükseltmek');
    const entry = ready().notebook[0];
    const prompt = actions.claudePrompt() ?? '';
    expect(prompt).toContain(`id: ${entry?.id}`);
    expect(prompt).toContain('textTr: "sorunu ekibe yükseltmek"');
    expect(prompt).toContain(`contextTr: ${JSON.stringify(bundle.items[0]?.situationTr)}`);
    expect(prompt).toContain(`Exported at: ${new Date(clock.now()).toISOString()}`);
    db.close();
  });
});

describe('items import', () => {
  it('invalid file: errors with paths, nothing written', async () => {
    const { db, actions, ready } = await setup();
    const r = await actions.importItemsFile(itemsFile([{ ...solved('x'), level: 9 }]));
    expect(r.status).toBe('invalid');
    if (r.status === 'invalid') expect(r.errors[0]?.path).toBe('items[0].level');
    expect(await db.getAll('importedItems')).toEqual([]);
    expect(ready().catalog.byId.has('x')).toBe(false);
    db.close();
  });

  it('a backup or a non-JSON file is refused with a code', async () => {
    const { db, actions } = await setup();
    expect(await actions.importItemsFile('{nope')).toMatchObject({ status: 'invalid', errors: [{ code: 'invalid-json' }] });
    expect(await actions.importItemsFile(JSON.stringify({ format: 'english-pwa-notebook', schemaVersion: 1 }))).toMatchObject({
      status: 'invalid',
      errors: [{ code: 'wrong-format' }],
    });
    expect(await actions.importItemsFile(itemsFile([]).replace('"schemaVersion":1', '"schemaVersion":2'))).toMatchObject({
      errors: [{ code: 'unsupported-version' }],
    });
    db.close();
  });

  it('rejects bundled ids, converts the matching notebook entry, adds the item to the catalog', async () => {
    const { db, actions, ready } = await setup();
    actions.openNotebook('home');
    await actions.saveNotebook('sorunu ekibe yükseltmek');
    const entryId = ready().notebook[0]?.id ?? '';

    const builtin = bundle.items[1]?.id ?? '';
    const r = await actions.importItemsFile(itemsFile([solved('escalate-the-issue', entryId), solved(builtin)]));
    expect(r).toEqual({ status: 'imported', importedIds: ['escalate-the-issue'], rejected: [{ id: builtin, reason: 'builtin-id' }] });

    const item = ready().catalog.byId.get('escalate-the-issue');
    expect(item).toMatchObject({ source: 'user-error', verified: true, verifiedNote: 'user-import', notebookId: entryId });
    expect(ready().catalog.byId.get(builtin)?.source).toBe('curated');
    expect(ready().notebook[0]).toMatchObject({ status: 'converted', convertedItemId: 'escalate-the-issue' });

    const stored = await loadAll(db, '2026-11-02');
    expect(stored.importedItems.map((i) => i.id)).toEqual(['escalate-the-issue']);
    expect(stored.notebook[0]).toMatchObject({ status: 'converted', convertedItemId: 'escalate-the-issue' });
    db.close();
  });

  it('paste: a ```json block with prose around it takes the same path as a file', async () => {
    const { db, actions, ready } = await setup();
    actions.openNotebook('home');
    await actions.saveNotebook('sorunu ekibe yükseltmek');
    const entryId = ready().notebook[0]?.id ?? '';
    const builtin = bundle.items[1]?.id ?? '';
    const file = JSON.stringify(JSON.parse(itemsFile([solved('escalate-the-issue', entryId), solved(builtin)])), null, 2);
    const reply = `İşte item dosyan:\n\n\`\`\`json\n${file}\n\`\`\`\n\nEmin olmadıklarım:\n- "escalate" yerine "raise" da olabilir.`;

    const r = await actions.importItemsPaste(reply);
    expect(r).toEqual({ status: 'imported', importedIds: ['escalate-the-issue'], rejected: [{ id: builtin, reason: 'builtin-id' }] });
    expect(ready().catalog.byId.get('escalate-the-issue')).toMatchObject({ source: 'user-error', notebookId: entryId });
    expect(ready().notebook[0]).toMatchObject({ status: 'converted', convertedItemId: 'escalate-the-issue' });
    const stored = await loadAll(db, '2026-11-02');
    expect(stored.importedItems.map((i) => i.id)).toEqual(['escalate-the-issue']);
    expect(stored.notebook[0]).toMatchObject({ status: 'converted' });
    db.close();
  });

  it('paste: raw JSON works; prose only or a broken block is invalid and writes nothing', async () => {
    const { db, actions, ready } = await setup();
    expect(await actions.importItemsPaste('Tabii, hemen hazırlıyorum.')).toMatchObject({ status: 'invalid', errors: [{ code: 'invalid-json' }] });
    expect(await actions.importItemsPaste('```json\n{"format": "english-pwa-items",\n```')).toMatchObject({
      status: 'invalid',
      errors: [{ code: 'invalid-json' }],
    });
    expect(await actions.importItemsPaste(`\`\`\`json\n${itemsFile([{ ...solved('x'), level: 9 }])}\n\`\`\``)).toMatchObject({
      status: 'invalid',
      errors: [{ code: 'invalid', path: 'items[0].level' }],
    });
    expect((await loadAll(db, '2026-11-02')).importedItems).toEqual([]);

    expect(await actions.importItemsPaste(`  ${itemsFile([solved('raw')])}\n`)).toMatchObject({ status: 'imported', importedIds: ['raw'] });
    expect(ready().catalog.byId.has('raw')).toBe(true);
    db.close();
  });

  async function setupAllAnswered(newIntroduced: number) {
    const name = `answered-${Math.random()}`;
    const db0 = await openAppDb({ name });
    for (const i of bundle.items) {
      await db0.put('progress', { itemId: i.id, box: 2, dueOn: '2026-11-04', introducedOn: '2026-11-01', lastAnsweredOn: '2026-11-01', lastGrade: 'correct', updatedAt: 1 });
    }
    await db0.put('dailyCounters', { day: '2026-11-02', newIntroduced, reviewsAnswered: 0 });
    db0.close();
    const { db, state } = await boot({ bundle, clock, openDb: () => openAppDb({ name }) });
    const store = createStore();
    store.dispatch({ type: 'booted', state });
    const actions = createActions({ db, clock, getState: store.getState, dispatch: store.dispatch });
    return { db, actions, ready: () => store.getState() as ReadyState };
  }

  it("with no open round, today's round is rebuilt so the imported card is reachable", async () => {
    const { db, actions, ready } = await setupAllAnswered(0);
    expect(ready().session).toBeUndefined();
    actions.openSettings();
    await actions.importItemsFile(itemsFile([solved('mine')]));
    expect(ready().session?.queue).toEqual([{ itemId: 'mine', kind: 'new' }]);
    actions.closeSettings();
    expect(ready().screen).toBe('home'); // "Devam et" opens the rebuilt round
    db.close();
  });

  it('imported items count toward the daily new-card cap (decision 3): cap used up → no round today', async () => {
    const { db, actions, ready } = await setupAllAnswered(5);
    await actions.importItemsFile(itemsFile([solved('mine')]));
    expect(ready().catalog.byId.has('mine')).toBe(true);
    expect(ready().session).toBeUndefined();
    db.close();
  });
});
