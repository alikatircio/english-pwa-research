import { Fragment, useRef, type KeyboardEvent } from 'react';
import { BLANK_TOKEN } from '../../domain/blankAnswers.ts';
import { t } from '../strings.tr.ts';

interface Props {
  /** The blanked sentence ("We're waiting ___ the ___."). */
  blanked: string;
  /** One value per blank. */
  values: readonly string[];
  onChange: (values: string[]) => void;
  /** Enter on the last blank with every blank filled. */
  onSubmit: () => void;
  disabled?: boolean;
  /** Visible heading that names the group (a11y). */
  labelledBy: string;
  describedBy: string;
}

/**
 * Decision 42: the blanked sentence with one small input per blank. Like the
 * answer field: no autocorrect, spellcheck or auto-capitalisation, ≥16px, ≥44px tall.
 * Enter moves to the next blank, on the last one it submits.
 */
export function ContextBlanks({ blanked, values, onChange, onSubmit, disabled, labelledBy, describedBy }: Props) {
  const parts = blanked.split(BLANK_TOKEN);
  const count = parts.length - 1;
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const at = (i: number): string => values[i] ?? '';

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>, i: number) {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
    e.preventDefault();
    if (i < count - 1) {
      refs.current[i + 1]?.focus();
      return;
    }
    const empty = Array.from({ length: count }, (_, k) => k).find((k) => at(k).trim() === '');
    if (empty === undefined) onSubmit();
    else refs.current[empty]?.focus();
  }

  return (
    <div className="context-blanks" role="group" aria-labelledby={labelledBy} aria-describedby={describedBy} lang="en" data-testid="context-blanks">
      {parts.map((part, i) => (
        <Fragment key={i}>
          {part !== '' && <span className="context-blanks__text">{part}</span>}
          {i < count && (
            <input
              ref={(el) => {
                refs.current[i] = el;
              }}
              className="context-blank"
              type="text"
              value={at(i)}
              onChange={(e) => onChange(Array.from({ length: count }, (_, k) => (k === i ? e.target.value : at(k))))}
              onKeyDown={(e) => onKeyDown(e, i)}
              disabled={disabled}
              aria-label={t.blankLabel(i + 1, count)}
              autoCorrect="off"
              autoCapitalize="off"
              autoComplete="off"
              spellCheck={false}
              enterKeyHint={i < count - 1 ? 'next' : 'go'}
              size={8}
            />
          )}
        </Fragment>
      ))}
    </div>
  );
}
