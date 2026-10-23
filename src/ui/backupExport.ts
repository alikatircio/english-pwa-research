import type { ExportFile } from '../app/actions.ts';
import { shareOrDownload, type ShareOutcome } from './share.ts';

export type BackupExportOutcome = 'shared' | 'downloaded' | 'cancelled' | 'failed';

/**
 * Hand a prepared backup to the share sheet / download and, unless the user cancelled,
 * remember the export time. Call it inside the tap with a file that was prepared earlier:
 * navigator.share() must start synchronously within the gesture (iOS), so nothing is awaited first.
 * Shared by Settings → Yedek and Home's "Şimdi yedekle".
 */
export async function exportPreparedBackup(
  file: ExportFile,
  markExported: () => Promise<unknown>,
  share: (f: ExportFile) => Promise<ShareOutcome> = shareOrDownload,
): Promise<BackupExportOutcome> {
  try {
    const outcome = await share(file);
    if (outcome === 'cancelled') return 'cancelled';
    await markExported();
    return outcome;
  } catch {
    return 'failed';
  }
}
