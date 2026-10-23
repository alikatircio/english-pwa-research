import { flushSync } from 'react-dom';
import { useEffect, useId, useRef, useState } from 'react';
import type { Actions } from '../../app/actions.ts';
import type { ReadyState } from '../../app/state.ts';
import { blankAnswers } from '../../domain/blankAnswers.ts';
import { gradeContext } from '../../domain/exerciseMode.ts';
import { currentEntry } from '../../domain/session.ts';
import { useDebouncedCallback } from '../hooks/useDebouncedCallback.ts';
import { RoundDots } from './RoundDots.tsx';
import { ContextBlanks } from './ContextBlanks.tsx';
import { t } from '../strings.tr.ts';

interface Props {
  state: ReadyState;
  actions: Actions;
}

/**
 * Decisions 49, 59: the last step of a free-practice round. A Teams/Jira message with
 * one-word blanks, checked per blank. Answer log only: no Leitner, progress or counters.
 */
export function MessageStep({ state, actions }: Props) {
  const session = state.session;
  const entry = session && currentEntry(session);
  const message = entry && state.messages?.find((m) => m.id === entry.itemId);
  const ids = useId();
  const headingId = `${ids}-heading`;
  const contextId = `${ids}-context`;
  const doneRef = useRef<HTMLButtonElement>(null);
  const persistDraft = useDebouncedCallback(actions.saveDraft, 300);
  const [values, setValues] = useState<string[]>(() => (session?.draft ?? '').split('\n'));
  const checked = session?.phase.tag === 'result';
  useEffect(() => {
    if (checked) doneRef.current?.focus();
  }, [checked]);

  if (!session || !entry || !message) return null;
  const answers = blankAnswers(message.blanked, message.text) ?? [];
  const count = answers.length;
  const typed = Array.from({ length: count }, (_, i) => values[i] ?? '');
  const filled = typed.every((v) => v.trim() !== '');
  const resultValues = session.phase.tag === 'result' ? session.phase.answer.split('\n') : typed;
  const results = checked ? answers.map((a, i) => gradeContext([resultValues[i] ?? ''], [a])) : undefined;
  const reaskAt = new Set<number>();

  function check() {
    if (!filled || state.busy) return;
    persistDraft.cancel();
    void actions.answerMessage(typed);
  }

  return (
    <div className="screen card-screen" data-testid="message-step">
      <header className="card-header">
        <button
          type="button"
          className="btn btn--text card-back"
          aria-label={t.backHomeLabel}
          disabled={state.busy}
          onClick={() => {
            persistDraft.flush();
            actions.leaveRound();
          }}
        >
          {t.backHome}
        </button>
      </header>
      <div className="screen__body">
        <RoundDots total={session.queue.length} cursor={session.cursor} reaskAt={reaskAt} label={t.roundProgress(session.cursor + 1, session.queue.length)} />
        <section className="question">
          <h2 id={headingId} className="label" data-testid="message-channel">
            {t.messageChannel[message.channel]}
          </h2>
          <p id={contextId} className="situation" data-testid="message-context">
            {message.contextTr}
          </p>
        </section>
        <ContextBlanks
          blanked={message.blanked}
          values={checked ? resultValues : typed}
          onChange={(next) => {
            setValues(next);
            persistDraft.call(session.cursor, next.join('\n'));
          }}
          onSubmit={check}
          disabled={state.busy}
          labelledBy={headingId}
          describedBy={contextId}
          multiline
          {...(results ? { results, answers } : {})}
        />
        <p className="visually-hidden" role="status">
          {results ? (results.every(Boolean) ? t.correct : t.notMatched) : ''}
        </p>
        {state.error === 'save-failed' && (
          <p className="error" role="alert">
            {t.saveFailed}
          </p>
        )}
      </div>
      <div className="screen__footer">
        {checked ? (
          <button ref={doneRef} type="button" className="btn btn--primary" disabled={state.busy} onClick={() => flushSync(() => actions.next())}>
            {t.messageDone}
          </button>
        ) : (
          <button type="button" className="btn btn--primary" disabled={state.busy || !filled} onClick={check}>
            {t.check}
          </button>
        )}
      </div>
    </div>
  );
}
