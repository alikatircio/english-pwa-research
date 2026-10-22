import { renderHint } from '../../domain/hints.ts';
import type { HintLevel, Item } from '../../domain/types.ts';
import { t } from '../strings.tr.ts';

interface Props {
  item: Item;
  /** 1 = cloze, 2 = cloze and the initials of the chunk (decision 35). */
  level: HintLevel;
}

function safeText(item: Item, stage: 1 | 2): string | undefined {
  try {
    const hint = renderHint(item, stage);
    return hint.kind === 'none' ? undefined : hint.text;
  } catch {
    // Content check C5 prevents this for shipped items; never break the card over a hint.
    return undefined;
  }
}

/** Hint under the situation, opened by the "İpucu" button (decision 35). */
export function HintLine({ item, level }: Props) {
  const cloze = safeText(item, 1);
  const initials = level === 2 ? safeText(item, 2) : undefined;
  if (cloze === undefined) return null;
  return (
    <div className="hint" data-testid="hint" data-stage={level}>
      <p className="hint__row">
        <span className="hint__label">{t.hint}</span>{' '}
        <span className="hint__text" lang="en" data-testid="hint-cloze">
          {cloze}
        </span>
      </p>
      {initials !== undefined && (
        <p className="hint__row">
          <span className="hint__label">{t.hintInitials}</span>{' '}
          <span className="hint__text" lang="en" data-testid="hint-initials">
            {initials}
          </span>
        </p>
      )}
    </div>
  );
}
