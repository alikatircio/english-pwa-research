// Hand a JSON file to the user (07 §3.8): Web Share with a file where the
// browser supports it (iOS share sheet → "Dosyalar'a kaydet"), else a download.
import type { ExportFile } from '../app/actions.ts';

export type ShareOutcome = 'shared' | 'downloaded' | 'cancelled';

function download(file: File): void {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.rel = 'noopener';
  document.body.append(a);
  a.click();
  a.remove();
  // Give the browser a moment to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export async function shareOrDownload({ filename, text }: ExportFile): Promise<ShareOutcome> {
  const file = new File([text], filename, { type: 'application/json' });
  const data = { files: [file] };
  if (typeof navigator.canShare === 'function' && navigator.canShare(data)) {
    try {
      await navigator.share(data);
      return 'shared';
    } catch (e) {
      // The user closed the share sheet: nothing to do.
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
      // NotAllowedError (gesture expired) or anything else: fall back to a download.
    }
  }
  download(file);
  return 'downloaded';
}

export type CopyOutcome = 'copied' | 'shared' | 'cancelled' | 'failed';

/**
 * Put text on the clipboard; where that is missing or refused, offer it via
 * the Web Share text sheet (iOS: "Kopyala" or straight into the Claude app).
 * Call inside the tap: both APIs need a user gesture.
 */
export async function copyOrShareText(text: string): Promise<CopyOutcome> {
  if (typeof navigator.clipboard?.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return 'copied';
    } catch {
      // Permission denied or no focus: try the share sheet.
    }
  }
  const data = { text };
  if (typeof navigator.share === 'function' && (typeof navigator.canShare !== 'function' || navigator.canShare(data))) {
    try {
      await navigator.share(data);
      return 'shared';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
    }
  }
  return 'failed';
}
