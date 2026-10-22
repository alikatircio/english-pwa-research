import { useEffect } from 'react';
import type { Notice } from '../../app/state.ts';
import { t } from '../strings.tr.ts';

export const NOTICE_MS = 4000;

interface Props {
  notice: Notice | undefined;
  onDismiss: () => void;
}

/**
 * Short confirmation after the notebook sheet closes ("Kaydedildi", plus the
 * duplicate warning). Overlaid on the top of the screen with absolute
 * positioning (never fixed, 02 §3), so the screen layout does not move.
 */
export function NoticeBar({ notice, onDismiss }: Props) {
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(onDismiss, NOTICE_MS);
    return () => clearTimeout(id);
  }, [notice, onDismiss]);

  if (notice?.kind !== 'notebook-saved') return null;
  // Rendered only while shown so it never competes with other status lines.
  return (
    <div className="notice-host">
      <p className={`notice${notice.duplicate ? ' notice--warn' : ''}`} role="status">
        {t.notebookSaved}
        {notice.duplicate && <> {t.notebookDuplicate}</>}
      </p>
    </div>
  );
}
