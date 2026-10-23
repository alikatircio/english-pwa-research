import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import fixture from '../../content/fixtures/e2e-items.json';
import { fixedClock } from '../domain/clock.ts';
import type { ContentBundle } from '../domain/types.ts';
import { openAppDb } from '../storage/db.ts';
import { commitGrade, saveSession } from '../storage/repo.ts';
import { newSession, SESSION_MAX_AGE_MS } from '../domain/session.ts';
import { createCatalog } from '../content/catalog.ts';
import { boot, resumableSession } from './boot.ts';
import { freshRound } from './round.ts';

const bundle = fixture as ContentBundle;
const clock = fixedClock(new Date(2026, 10, 2, 8).getTime());

describe('boot', () => {
  it('loads catalog, progress and counter, and builds the round from buildRound', async () => {
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
    expect(state.screen).toBe('home'); // always opens on Home (05 §1)
    expect(state.session).toBeUndefined(); // the round starts from "Başla"
    // One new card already introduced today → 9 of the daily 10 left (decision 29), a round holds 8; file order.
    const round = freshRound(state, state.counter, clock);
    expect(round?.queue).toEqual(bundle.items.slice(1, 9).map((i) => ({ itemId: i.id, kind: 'new' })));
    expect(round?.day).toBe('2026-11-02');
    opened.close();
  });
});

describe('boot — session resume', () => {
  const t0 = new Date(2026, 10, 2, 8).getTime();
  const stored = {
    ...newSession(bundle.items.map((i) => ({ itemId: i.id, kind: 'new' as const })), '2026-11-02', t0),
    cursor: 3,
    draft: 'Could you expl',
  };

  async function bootAt(ms: number, session = stored) {
    const name = `resume-${ms}-${Math.random()}`;
    const db = await openAppDb({ name });
    await saveSession(db, session);
    db.close();
    const r = await boot({ bundle, clock: fixedClock(ms), openDb: () => openAppDb({ name }) });
    const left = await r.db.get('session', 'current');
    r.db.close();
    return { session: r.state.session, left };
  }

  it('resumes the same card and draft on the same day within 12 h', async () => {
    const { session } = await bootAt(t0 + 60 * 60 * 1000);
    expect(session?.cursor).toBe(3);
    expect(session?.draft).toBe('Could you expl');
  });

  it('resumes a result phase as a result phase', async () => {
    const result = { ...stored, phase: { tag: 'result' as const, answer: 'x', matched: false as const } };
    const { session } = await bootAt(t0 + 1000, result);
    expect(session?.phase).toEqual(result.phase);
  });

  it('drops a session older than 12 h', async () => {
    const later = new Date(2026, 10, 2, 8).getTime() + SESSION_MAX_AGE_MS + 1;
    const { session, left } = await bootAt(later);
    expect(session).toBeUndefined();
    expect(left).toBeUndefined();
  });

  it('drops a session from another day', async () => {
    const { session, left } = await bootAt(new Date(2026, 10, 3, 0, 30).getTime());
    expect(session).toBeUndefined();
    expect(left).toBeUndefined();
  });
});

describe('resumableSession — flags (T2.5)', () => {
  it('skips a flagged current card and keeps the rest of the queue', () => {
    const catalog = createCatalog(bundle);
    const t0 = new Date(2026, 10, 2, 8).getTime();
    const s = {
      ...newSession(
        [
          { itemId: 'e2e-will-send', kind: 'new' as const },
          { itemId: 'e2e-discuss', kind: 'new' as const },
          { itemId: 'e2e-will-send', kind: 'repeat' as const },
        ],
        '2026-11-02',
        t0,
      ),
      draft: 'half',
    };
    const r = resumableSession(s, catalog, fixedClock(t0), new Set(['e2e-will-send']));
    expect(r?.cursor).toBe(1);
    expect(r?.draft).toBe('');
    expect(r?.queue).toHaveLength(3);
  });

  it('does not resume onto a flagged card', () => {
    const catalog = createCatalog(bundle);
    const t0 = new Date(2026, 10, 2, 8).getTime();
    const s = newSession([{ itemId: 'e2e-will-send', kind: 'new' }], '2026-11-02', t0);
    expect(resumableSession(s, catalog, fixedClock(t0))).toBe(s);
    expect(resumableSession(s, catalog, fixedClock(t0), new Set(['e2e-will-send']))).toBeUndefined();
  });
});

describe('boot — stale message step', () => {
  it('resumes without a stored message step whose message left the bundle', async () => {
    const t0 = new Date(2026, 10, 2, 8).getTime();
    const queue = [...bundle.items.slice(0, 2).map((i) => ({ itemId: i.id, kind: 'new' as const })), { itemId: 'gone-msg', kind: 'message' as const }];
    const session = { ...newSession(queue, '2026-11-02', t0), cursor: 2 };
    const name = `stale-msg-${Math.random()}`;
    const db = await openAppDb({ name });
    await saveSession(db, session);
    db.close();
    const r = await boot({ bundle, clock: fixedClock(t0 + 1000), openDb: () => openAppDb({ name }), extras: { diagnostic: [], messages: [] } });
    r.db.close();
    expect(r.state.session).toBeUndefined();
  });
});
