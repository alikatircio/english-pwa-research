interface Props {
  /** Queue length, re-asks included: grows when a re-ask is queued (decision 38). */
  total: number;
  /** Queue positions that are in-round re-asks: drawn as dashed dots. */
  reaskAt?: ReadonlySet<number>;
  /** Index of the card on screen. */
  cursor: number;
  label: string;
}

/**
 * Decisions 1, 38, 05 §2: a row of dots inside the round (●●●○○○○○). Derived from
 * the queue, never saved, gone when the round ends. One image for assistive tech.
 */
export function RoundDots({ total, cursor, label, reaskAt }: Props) {
  return (
    <div className="round-dots" data-testid="round-dots" role="img" aria-label={label}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`round-dots__dot round-dots__dot--${i < cursor ? 'done' : i === cursor ? 'current' : 'todo'}${reaskAt?.has(i) ? ' round-dots__dot--reask' : ''}`}
        />
      ))}
    </div>
  );
}
