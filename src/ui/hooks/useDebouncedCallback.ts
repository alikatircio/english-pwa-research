import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';

export interface Debounced<A extends unknown[]> {
  call: (...args: A) => void;
  /** Run a pending call now (e.g. on visibilitychange → hidden). */
  flush: () => void;
  cancel: () => void;
}

/** Trailing-edge debounce that always calls the latest `fn`. Pending calls are flushed on unmount. */
export function useDebouncedCallback<A extends unknown[]>(fn: (...args: A) => void, delayMs: number): Debounced<A> {
  const fnRef = useRef(fn);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pending = useRef<A | undefined>(undefined);

  useLayoutEffect(() => {
    fnRef.current = fn;
  });

  const cancel = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = undefined;
    pending.current = undefined;
  }, []);

  const flush = useCallback(() => {
    const args = pending.current;
    cancel();
    if (args) fnRef.current(...args);
  }, [cancel]);

  const call = useCallback(
    (...args: A) => {
      pending.current = args;
      clearTimeout(timer.current);
      timer.current = setTimeout(flush, delayMs);
    },
    [delayMs, flush],
  );

  useEffect(() => flush, [flush]);

  return useMemo(() => ({ call, flush, cancel }), [call, flush, cancel]);
}
