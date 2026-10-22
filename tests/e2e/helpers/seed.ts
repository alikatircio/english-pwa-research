/// <reference lib="dom" />
import type { Page } from '@playwright/test';
import type { Progress } from '../../../src/domain/types.ts';

export interface Seed {
  put?: Record<string, unknown[]>;
  delete?: Record<string, IDBValidKey[]>;
}

/** Write records straight into the app DB (english-pwa), one transaction. Reload afterwards. */
export function seedStores(page: Page, seed: Seed): Promise<void> {
  // Passed as JSON text: Playwright's serialisable-type inference does not cope with `unknown` rows.
  return page.evaluate(
    (text) =>
      new Promise<void>((resolve, reject) => {
        const s = JSON.parse(text) as { put?: Record<string, unknown[]>; delete?: Record<string, IDBValidKey[]> };
        const open = indexedDB.open('english-pwa');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const names = [...new Set([...Object.keys(s.put ?? {}), ...Object.keys(s.delete ?? {})])];
          const tx = db.transaction(names, 'readwrite');
          for (const [name, rows] of Object.entries(s.put ?? {})) for (const r of rows) tx.objectStore(name).put(r);
          for (const [name, keys] of Object.entries(s.delete ?? {})) for (const k of keys) tx.objectStore(name).delete(k);
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    JSON.stringify(seed),
  );
}

/** Every given item answered (box 2, due later) and no open round → Home says "Bugün bitti" after a reload. */
export function answeredProgress(ids: readonly string[], day = '2026-11-02'): Progress[] {
  return ids.map((itemId) => ({
    itemId,
    box: 2,
    dueOn: '2026-11-04',
    introducedOn: day,
    lastAnsweredOn: day,
    lastGrade: 'correct',
    updatedAt: 1,
  }));
}

/** Make `navigator.share` unavailable so exports take the download path (Playwright cannot drive a share sheet). */
export async function disableWebShare(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'canShare', { value: undefined, configurable: true });
    Object.defineProperty(Navigator.prototype, 'share', { value: undefined, configurable: true });
  });
}
