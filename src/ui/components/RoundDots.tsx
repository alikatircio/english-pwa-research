interface Props {
  /** Queue length, repeats included: grows when a repeat is queued. */
  total: number;
  /** Index of the card on screen. */
  cursor: number;
  label: string;
}

/**
 * Decision 1, 05 §2: a row of dots inside the round (●●●○○○○○). Derived from
 * the queue, never saved, gone when the round ends. One image for assistive tech.
 */
export function RoundDots({ total, cursor, label }: Props) {
  return (
    <div className="round-dots" data-testid="round-dots" role="img" aria-label={label}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={`round-dots__dot round-dots__dot--${i < cursor ? 'done' : i === cursor ? 'current' : 'todo'}`} />
      ))}
    </div>
  );
}
