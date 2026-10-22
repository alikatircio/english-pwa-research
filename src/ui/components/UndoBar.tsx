import { useEffect, useState } from 'react';
import { t } from '../strings.tr.ts';

interface Props {
  /** Epoch ms when the undo window closes. Remount (key) per snapshot. */
  expiresAt: number;
  /** The app's injected clock (actions.now), the same one undo() checks against (09 #14). */
  now: () => number;
  onUndo: () => void;
  disabled?: boolean;
}

/**
 * Decision 10: a 4 s "Geri al" after a self-grade, for mis-taps on a shaky train.
 * A timer can fire late after the app was in the background, so the window is also
 * re-checked on return to the app and on the tap itself: an expired "Geri al" is
 * never shown as if it still worked.
 */
export function UndoBar({ expiresAt, now, onUndo, disabled }: Props) {
  const [expired, setExpired] = useState(() => now() >= expiresAt);
  useEffect(() => {
    if (expired) return;
    const check = () => {
      if (now() >= expiresAt) setExpired(true);
    };
    const id = window.setTimeout(() => setExpired(true), Math.max(0, expiresAt - now()));
    document.addEventListener('visibilitychange', check);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener('visibilitychange', check);
    };
  }, [expiresAt, now, expired]);
  if (expired) return null;
  return (
    <button
      type="button"
      className="btn btn--undo"
      onClick={() => {
        if (now() >= expiresAt) setExpired(true);
        else onUndo();
      }}
      disabled={disabled}
    >
      <span aria-hidden="true">↶</span>&nbsp;{t.undo}
    </button>
  );
}
