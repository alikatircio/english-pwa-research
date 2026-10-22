import { useEffect, useState } from 'react';
import { t } from '../strings.tr.ts';

interface Props {
  /** Epoch ms when the undo window closes. Remount (key) per snapshot. */
  expiresAt: number;
  onUndo: () => void;
  disabled?: boolean;
}

/** Decision 10: a 4 s "Geri al" after a self-grade, for mis-taps on a shaky train. */
export function UndoBar({ expiresAt, onUndo, disabled }: Props) {
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setExpired(true), Math.max(0, expiresAt - Date.now()));
    return () => window.clearTimeout(id);
  }, [expiresAt]);
  if (expired) return null;
  return (
    <button type="button" className="btn btn--undo" onClick={onUndo} disabled={disabled}>
      <span aria-hidden="true">↶</span>&nbsp;{t.undo}
    </button>
  );
}
