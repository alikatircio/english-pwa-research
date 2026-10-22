import { useState } from 'react';
import type { Item } from '../../domain/types.ts';
import { t } from '../strings.tr.ts';

interface Props {
  item: Item;
  /** Decision 11: open after a wrong/partial (unmatched) answer, closed after a match. */
  defaultOpen: boolean;
  /** Model sentences are already listed above on a matched result. */
  showSentences: boolean;
  /** Decision 33: the commonMistake stays hidden while the box is ≤ 2. */
  showMistake: boolean;
}

/** Pattern card: a collapsible section at the bottom of the result (02 §2), not a screen. */
export function PatternCard({ item, defaultOpen, showSentences, showMistake }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <details className="pattern-card" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="pattern-card__summary">
        <span className="label">{t.patternCard}</span>
        <span className="pattern-card__chunk" lang="en">
          {item.targetChunk}
        </span>
      </summary>
      <div className="pattern-card__body">
        {item.patternSlots && (
          <p className="pattern-card__slots" lang="en">
            {item.patternSlots}
          </p>
        )}
        {showSentences && (
          <div className="block">
            <h3 className="label">{t.modelSentences}</h3>
            <ul className="sentences" lang="en">
              {item.modelSentences.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
        )}
        {showMistake && item.commonMistake && (
          <div className="block">
            <h3 className="label">{t.commonMistake}</h3>
            <p className="pattern-card__mistake" lang="en">
              <span aria-hidden="true">✗ </span>
              <s>{item.commonMistake}</s>
            </p>
          </div>
        )}
        <div className="block">
          <h3 className="label">{t.note}</h3>
          <p className="pattern-card__note">{item.noteTr}</p>
        </div>
      </div>
    </details>
  );
}
