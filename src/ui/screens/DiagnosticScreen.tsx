import { useEffect, useRef } from 'react';
import type { DiagnosticView } from '../../app/mode.ts';
import type { Actions } from '../../app/actions.ts';
import type { ReadyState } from '../../app/state.ts';
import { diagnosticQuestions } from '../diagnosticQuestions.ts';
import { optionOrder, type OptionId, type Selection } from '../../domain/diagnostic.ts';
import { t } from '../strings.tr.ts';

interface Props {
  state: ReadyState;
  actions: Actions;
  onView: (view: DiagnosticView | undefined) => void;
}

/** A question counts as answered with at least one option or "Emin değilim"; an emptied selection does not. */
const isAnswered = (a: { chosen: string[]; unsure: boolean } | undefined): boolean => !!a && (a.unsure || a.chosen.length > 0);

/**
 * Seviye testi question view (decision 47). One question at a time; every answer is written
 * before the next tap. Leaving to Settings keeps the attempt; reopening resumes at the cursor
 * with the same option order (seeded by attempt id).
 */
export function DiagnosticScreen({ state, actions, onView }: Props) {
  const open = state.diagnostic?.open;
  const heading = useRef<HTMLHeadingElement>(null);
  const qid = open?.order[open.cursor];
  useEffect(() => {
    heading.current?.focus();
  }, [qid]);

  const question = diagnosticQuestions.find((q) => q.id === qid);
  if (!open || !qid || !question) {
    return (
      <div className="screen diagnostic-screen">
        <div className="screen__body">
          <p className="muted">{t.diagNoAttempts}</p>
          <button type="button" className="btn" onClick={() => onView(undefined)}>
            {t.diagBackToSettings}
          </button>
        </div>
      </div>
    );
  }

  const answer = open.answers[qid];
  const chosen = new Set(answer?.chosen ?? []);
  const unsure = answer?.unsure ?? false;
  const total = open.order.length;
  const allAnswered = open.order.every((id) => isAnswered(open.answers[id]));
  const isLast = open.cursor === total - 1;
  const texts = new Map(question.options.map((o) => [o.id, o.text]));

  function toggle(id: OptionId) {
    const next = new Set(chosen);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    void actions.answerDiagnostic(qid as string, [...next] as Selection);
  }

  async function finish() {
    await actions.finishDiagnostic();
    onView({ kind: 'result', attemptId: (open as NonNullable<typeof open>).id });
  }

  return (
    <div className="screen diagnostic-screen">
      <div className="screen__body">
        <div className="sheet__header">
          <h2 className="sheet__title">{t.diagTitle}</h2>
          <button type="button" className="btn btn--text" onClick={() => onView(undefined)}>
            {t.diagBackToSettings}
          </button>
        </div>

        <p className="muted" role="status" aria-live="polite" data-testid="diag-progress">
          {t.diagProgress(open.cursor + 1, total)}
        </p>

        <h3 className="label" ref={heading} tabIndex={-1}>
          {question.promptTr}
        </h3>
        <p className="diag-stem" lang="en">
          {question.stem}
        </p>

        <fieldset className="diag-options">
          <legend className="muted">{t.diagMultiHint}</legend>
          {optionOrder(open.id, question).map((id) => (
            <label key={id} className={chosen.has(id) ? 'diag-option diag-option--on' : 'diag-option'}>
              <input type="checkbox" checked={chosen.has(id)} disabled={state.busy} onChange={() => toggle(id)} />
              <span lang="en">{texts.get(id)}</span>
            </label>
          ))}
        </fieldset>

        <button
          type="button"
          className={unsure ? 'btn btn--choice diag-unsure diag-unsure--on' : 'btn btn--choice diag-unsure'}
          aria-pressed={unsure}
          disabled={state.busy}
          onClick={() => void actions.answerDiagnostic(qid, 'unsure')}
        >
          {t.diagUnsure}
        </button>

        <div className="diag-nav">
          <button type="button" className="btn" disabled={state.busy || open.cursor === 0} onClick={() => void actions.moveDiagnostic('prev')}>
            {t.diagPrev}
          </button>
          <button type="button" className="btn" disabled={state.busy || isLast} onClick={() => void actions.moveDiagnostic('next')}>
            {t.diagNext}
          </button>
        </div>
        <button type="button" className="btn btn--primary" disabled={state.busy || !allAnswered} onClick={() => void finish()}>
          {t.diagFinish}
        </button>
        {!allAnswered && <p className="muted">{t.diagFinishHint}</p>}
      </div>
    </div>
  );
}
