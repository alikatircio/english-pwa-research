import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import fixture from '../../content/fixtures/e2e-items.json';
import { fixedClock } from '../domain/clock.ts';
import type { ContentBundle } from '../domain/types.ts';
import { openAppDb } from '../storage/db.ts';
import { commitGrade } from '../storage/repo.ts';
import { boot } from './boot.ts';

const bundle = fixture as ContentBundle;
const clock = fixedClock(new Date(2026, 10, 2, 8).getTime());

describe('boot', () => {
  it('loads catalog and progress into memory and queues unanswered items in file order', async () => {
    const name = `boot-${Date.now()}`;
    const db = await openAppDb({ name });
    await commitGrade(db, {
      progress: { itemId: 'e2e-will-send', box: 2, dueOn: '2026-11-04', introducedOn: '2026-11-02', lastAnsweredOn: '2026-11-02', lastGrade: 'correct', updatedAt: 1 },
      counter: { day: '2026-11-02', newIntroduced: 1, reviewsAnswered: 0 },
      log: { at: 1, day: '2026-11-02', itemId: 'e2e-will-send', answer: 'x', grade: 'correct', gradedBy: 'auto', hintStage: 1, isRepeat: false, boxBefore: null, boxAfter: 2 },
    });
    db.close();

    const { db: opened, state } = await boot({ bundle, clock, openDb: () => openAppDb({ name }) });
    expect(state.catalog.items).toHaveLength(12);
    expect(state.progress.get('e2e-will-send')?.box).toBe(2);
    expect(state.counter.newIntroduced).toBe(1);
    expect(state.screen).toBe('card');
    expect(state.session?.queue.map((q) => q.itemId)).toEqual(bundle.items.slice(1).map((i) => i.id));
    expect(state.session?.day).toBe('2026-11-02');
    opened.close();
  });
});
