import { useEffect, useRef, useState } from 'react';
import { t } from '../strings.tr.ts';

interface Props {
  /** Shuffled words of the answer (punctuation attached). Index = chip id. */
  tokens: readonly string[];
  /** Placed words in order, on every change. */
  onChange: (placed: string[]) => void;
  disabled?: boolean;
  /** Heading that names the exercise. */
  labelledBy: string;
}

/**
 * "Sırala" (decision 31c): tap a word to append it to the sentence, tap a placed
 * word to send it back. Tap only, no drag; chips are ≥44px and wrap, so it works
 * with one thumb. The sentence is built in the upper box, the loose words sit below.
 */
export function WordOrder({ tokens, onChange, disabled, labelledBy }: Props) {
  const [placed, setPlaced] = useState<number[]>([]);
  /** Chip that should take focus after the next render (the tapped button is gone from its list). */
  const focusId = useRef<number | null>(null);
  const chipRefs = useRef(new Map<number, HTMLButtonElement>());

  useEffect(() => {
    if (focusId.current === null) return;
    chipRefs.current.get(focusId.current)?.focus();
    focusId.current = null;
  });

  function update(next: number[], focus: number | null) {
    focusId.current = focus;
    setPlaced(next);
    onChange(next.map((id) => tokens[id] ?? ''));
  }

  const pool = tokens.map((_, id) => id).filter((id) => !placed.includes(id));
  const ref = (id: number) => (el: HTMLButtonElement | null) => {
    if (el) chipRefs.current.set(id, el);
    else chipRefs.current.delete(id);
  };

  return (
    <div className="word-order" role="group" aria-labelledby={labelledBy}>
      <p className="visually-hidden" role="status">
        {t.orderProgress(placed.length, tokens.length)}
      </p>
      <div className="word-order__placed" role="group" aria-label={t.orderPlacedLabel} data-testid="order-placed" lang="en">
        {placed.length === 0 && (
          <span className="word-order__empty" lang="tr">
            {t.orderEmpty}
          </span>
        )}
        {placed.map((id, pos) => (
          <button
            key={id}
            ref={ref(id)}
            type="button"
            className="chip chip--placed"
            aria-label={t.orderChipRemove(tokens[id] ?? '', pos + 1)}
            disabled={disabled}
            onClick={() => update(placed.filter((p) => p !== id), id)}
          >
            {tokens[id]}
          </button>
        ))}
      </div>
      <div className="word-order__pool" role="group" aria-label={t.orderPoolLabel} data-testid="order-pool" lang="en">
        {pool.map((id) => (
          <button
            key={id}
            ref={ref(id)}
            type="button"
            className="chip"
            aria-label={t.orderChipAdd(tokens[id] ?? '')}
            disabled={disabled}
            onClick={() => update([...placed, id], pool.find((p) => p !== id) ?? null)}
          >
            {tokens[id]}
          </button>
        ))}
      </div>
    </div>
  );
}
