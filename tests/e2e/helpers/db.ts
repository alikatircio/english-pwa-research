/// <reference lib="dom" />
import type { Page } from '@playwright/test';

/** Read every record of one IndexedDB store of the app DB (english-pwa). */
export function readStore<T = unknown>(page: Page, store: string): Promise<T[]> {
  return page.evaluate(
    (name) =>
      new Promise<T[]>((resolve, reject) => {
        const open = indexedDB.open('english-pwa');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const req = db.transaction(name, 'readonly').objectStore(name).getAll();
          req.onsuccess = () => {
            resolve(req.result as T[]);
            db.close();
          };
          req.onerror = () => reject(req.error);
        };
      }),
    store,
  );
}
