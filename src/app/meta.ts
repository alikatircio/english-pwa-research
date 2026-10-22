// The `meta` store as typed in-memory values. Rows with an unexpected value
// type are ignored (treated as never set) instead of failing the boot.
import type { MetaRecord } from '../domain/types.ts';

export interface AppMeta {
  /** First "Başla" (or a restore) on this device, epoch ms. */
  firstRunAt?: number | undefined;
  /** Last full backup handed to the share sheet / download, epoch ms. */
  lastExportAt?: number | undefined;
  /** Result of the last navigator.storage.persist() request; undefined = never asked. */
  persist?: boolean | undefined;
  /** "Ana ekrana ekle" hint closed for good. */
  installHintDismissed?: boolean | undefined;
  /** Backup reminder closed at, epoch ms (hidden for 7 days). */
  backupReminderDismissedAt?: number | undefined;
}

const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const bool = (v: unknown): boolean | undefined => (typeof v === 'boolean' ? v : undefined);

export function metaFromRecords(records: readonly MetaRecord[]): AppMeta {
  const byKey = new Map(records.map((r) => [r.key, r.value]));
  return {
    firstRunAt: num(byKey.get('firstRunAt')),
    lastExportAt: num(byKey.get('lastExportAt')),
    persist: bool(byKey.get('persist')),
    installHintDismissed: bool(byKey.get('installHintDismissed')),
    backupReminderDismissedAt: num(byKey.get('backupReminderDismissedAt')),
  };
}
