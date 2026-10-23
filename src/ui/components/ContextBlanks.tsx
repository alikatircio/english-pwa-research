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
  /** Message step: keep the line breaks of `blanked`. */
  multiline?: boolean;
  /** Per-blank verdict after "Kontrol et": inputs lock, ✓/✗ shows. Needs `answers`. */
  results?: readonly boolean[];
  /** The expected word per blank, shown next to a wrong one. */
  answers?: readonly string[];
}

/**
 * Decision 42: the blanked sentence with one small input per blank. Like the
 * answer field: no autocorrect, spellcheck or auto-capitalisation, ≥16px, ≥44px tall.
 * Enter moves to the next blank, on the last one it submits.
 */
export function ContextBlanks({ blanked, values, onChange, onSubmit, disabled, labelledBy, describedBy, multiline, results, answers }: Props) {
  const lines = multiline ? blanked.split('\n') : [blanked];
  const count = blanked.split(BLANK_TOKEN).length - 1;
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
      {lines.map((line, li) => {
        const parts = line.split(BLANK_TOKEN);
        const start = lines.slice(0, li).reduce((n, l) => n + l.split(BLANK_TOKEN).length - 1, 0);
        const body = parts.map((part, pi) => {
          const i = start + pi;
          return (
            <Fragment key={pi}>
              {part !== '' && <span className="context-blanks__text">{part}</span>}
              {pi < parts.length - 1 && (
                <>
                  <input
                    ref={(el) => {
                      refs.current[i] = el;
                    }}
                    className={`context-blank${results ? (results[i] ? ' context-blank--ok' : ' context-blank--wrong') : ''}`}
                    type="text"
                    value={at(i)}
                    onChange={(e) => onChange(Array.from({ length: count }, (_, k) => (k === i ? e.target.value : at(k))))}
                    onKeyDown={(e) => onKeyDown(e, i)}
                    disabled={disabled}
                    readOnly={results !== undefined}
                    aria-label={t.blankLabel(i + 1, count)}
                    autoCorrect="off"
                    autoCapitalize="off"
                    autoComplete="off"
                    spellCheck={false}
                    enterKeyHint={i < count - 1 ? 'next' : 'go'}
                    size={8}
                  />
                  {results && (
                    <span className="context-blank__result" data-testid="context-blank-result" data-correct={results[i] ? 'true' : 'false'}>
                      <span aria-hidden="true">{results[i] ? '✓' : '✗'}</span>
                      <span className="visually-hidden">{results[i] ? t.blankRight : t.blankWrong}</span>
                      {!results[i] && <span className="context-blank__expected">{answers?.[i]}</span>}
                    </span>
                  )}
                </>
              )}
            </Fragment>
          );
        });
        return multiline ? (
          <div key={li} className="context-blanks__line">
            {body}
          </div>
        ) : (
          body
        );
      })}
    </div>
  );
}
