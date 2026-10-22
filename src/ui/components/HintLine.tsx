import { renderHint, type Hint } from '../../domain/hints.ts';
import type { HintStage, Item } from '../../domain/types.ts';
import { t } from '../strings.tr.ts';

interface Props {
  item: Item;
  stage: HintStage;
}

function safeHint(item: Item, stage: HintStage): Hint {
  try {
    return renderHint(item, stage);
  } catch {
    // Content check C5 prevents this for shipped items; never break the card over a hint.
    return { kind: 'none' };
  }
}

/** Hint line under the situation (decision 4): stage 1 cloze, stage 2 initials, stage 3 nothing. */
export function HintLine({ item, stage }: Props) {
  const hint = safeHint(item, stage);
  if (hint.kind === 'none') return null;
  return (
    <p className={`hint hint--${hint.kind}`} data-testid="hint" data-stage={stage}>
      <span className="hint__label">{t.hint}</span>{' '}
      <span className="hint__text" lang="en">
        {hint.text}
      </span>
    </p>
  );
}
