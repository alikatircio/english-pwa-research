import { useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import type { Actions } from '../../app/actions.ts';
import type { ReadyState } from '../../app/state.ts';
import { focusCard } from '../focusCard.ts';
import { t } from '../strings.tr.ts';

interface Props {
  state: ReadyState;
  actions: Actions;
}

/**
 * Round end (05 §2–3): "Tur bitti." and one line of the chunks studied, no
 * numbers. Two equal buttons, no nudge to either side. When nothing is left
 * today, "Bugün bitti" replaces "Bir tur daha".
 */
export function RoundEndScreen({ state, actions }: Props) {
  const summary = state.lastRound;
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);
  const chunks = summary?.studiedChunks ?? [];
  const more = summary?.moreToday ?? false;

  function another() {
    flushSync(actions.startRound);
    focusCard();
  }

  return (
    <div className="screen round-end">
      <div className="screen__body screen__body--center">
        <h2 ref={headingRef} tabIndex={-1} className="done__title">
          {t.roundDone}
        </h2>
        {chunks.length > 0 && <p className="round-end__summary">{t.roundSummary(chunks)}</p>}
        {!more && (
          <p className="muted">
            {t.todayDone} {t.todayDoneDetail}
          </p>
        )}
      </div>
      <div className="screen__footer">
        <div className={more ? 'choice-buttons' : undefined}>
          {more && (
            <button type="button" className="btn btn--choice" onClick={another} disabled={state.busy}>
              {t.anotherRound}
            </button>
          )}
          <button type="button" className="btn btn--choice" onClick={actions.finish} disabled={state.busy}>
            {t.enough}
          </button>
        </div>
      </div>
    </div>
  );
}
