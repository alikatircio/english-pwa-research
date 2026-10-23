import { useEffect, useId, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type { Actions } from '../../app/actions.ts';
import type { ReadyState } from '../../app/state.ts';
import { contextForEntry, modeForEntry } from '../../app/mode.ts';
import { shuffleTokens, showsBefore } from '../../domain/exerciseMode.ts';
import { currentEntry } from '../../domain/session.ts';
import { AnswerInput } from '../components/AnswerInput.tsx';
import { ContextBlanks } from '../components/ContextBlanks.tsx';
import { MessageStep } from '../components/MessageStep.tsx';
import { FlagButton } from '../components/FlagButton.tsx';
import { GradeButtons } from '../components/GradeButtons.tsx';
import { HintLine } from '../components/HintLine.tsx';
import { useDebouncedCallback } from '../hooks/useDebouncedCallback.ts';
import { useVisualViewportHeight } from '../hooks/useVisualViewportHeight.ts';
import { ResultPanel } from '../components/ResultPanel.tsx';
import { WordOrder } from '../components/WordOrder.tsx';
import { StudyView } from '../components/StudyView.tsx';
import { RoundDots } from '../components/RoundDots.tsx';
import { UndoBar } from '../components/UndoBar.tsx';
import { t } from '../strings.tr.ts';

/** "[Teams, nazik rica] Mert'e yazıyorsun…" → tag + text. */
function splitSituation(s: string): { tag?: string; text: string } {
  const m = /^\[([^\]]+)\]\s*([\s\S]*)$/.exec(s);
  return m ? { tag: m[1], text: m[2] ?? '' } : { text: s };
}

interface Props {
  state: ReadyState;
  actions: Actions;
}

export function CardScreen({ state, actions }: Props) {
  const session = state.session;
  const entry = session && currentEntry(session);
  const item = entry && state.catalog.byId.get(entry.itemId);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const verdictRef = useRef<HTMLHeadingElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const ids = useId();
  const headingId = `${ids}-heading`;
  const tagId = `${ids}-tag`;
  const situationId = `${ids}-situation`;
  const mistakeId = `${ids}-mistake`;
  /** Where focus goes once the next render lands (a11y audit 08 #2, #3): the removed control would drop it to <body>. */
  const pendingFocus = useRef<'verdict' | 'next' | null>(null);
  useEffect(() => {
    const target = pendingFocus.current === 'verdict' ? verdictRef.current : pendingFocus.current === 'next' ? nextRef.current : null;
    if (target) {
      target.focus();
      pendingFocus.current = null;
    }
  });
  useVisualViewportHeight();
  // Draft lives locally while typing; keyed per card so it resets on "Sonraki".
  const cardKey = `${session?.cursor ?? 0}:${entry?.itemId ?? ''}`;
  const [draft, setDraft] = useState({ key: cardKey, text: session?.draft ?? '' });
  if (draft.key !== cardKey) setDraft({ key: cardKey, text: session?.draft ?? '' });

  // Draft → IDB about 300 ms after typing stops (02 §3); flushed when the page is hidden.
  const persistDraft = useDebouncedCallback(actions.saveDraft, 300);
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') persistDraft.flush();
      // Back after hours or on another day: drop the old round, as Home does (09 #5).
      else void actions.dropStaleSession();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [persistDraft, actions]);

  if (entry?.kind === 'message') return <MessageStep state={state} actions={actions} />;
  if (!session || !item) return null;
  const phase = session.phase;
  const { tag, text } = splitSituation(item.situationTr);
  const reaskAt = new Set(session.queue.flatMap((e, i) => (e.kind === 'repeat' ? [i] : [])));
  // Only the question needs the mode; the result looks the same for every shape.
  const mode = phase.tag === 'question' ? modeForEntry(state, entry, session.cursor, session.queue.length) : 'write';
  const context = phase.tag === 'question' && mode === 'context' ? contextForEntry(state, entry, session.cursor, session.queue.length) : null;
  const blankValues = draft.text.split('\n');
  const canCheck = context ? Array.from({ length: context.answers.length }, (_, i) => (blankValues[i] ?? '').trim() !== '').every(Boolean) : draft.text.trim() !== '';
  const orderTokens =
    mode === 'order'
      ? shuffleTokens(item.acceptedAnswers[0] ?? '', `${item.id}:${session.cursor}:${showsBefore(state.progress.get(item.id) ?? null)}`)
      : [];
  const heading = phase.tag !== 'question' || mode === 'write' ? (item.source === 'user-error' ? t.userErrorHeading : t.questionHeading) : mode === 'fix' ? t.fixHeading : mode === 'context' ? t.contextHeading : t.orderHeading;

  /** Same-tap focus (iOS keyboard rule): the textarea, or the first blank of a 'context' card. */
  function focusAnswer() {
    (inputRef.current ?? document.querySelector<HTMLInputElement>('.context-blank'))?.focus();
  }

  function onDraftChange(text: string) {
    setDraft({ key: cardKey, text });
    if (session) persistDraft.call(session.cursor, text);
  }

  function submit() {
    persistDraft.cancel(); // submitAnswer stores the text with the result
    pendingFocus.current = 'verdict';
    void actions.submitAnswer(draft.text);
  }

  function next() {
    // Render the next question synchronously, then focus inside the same tap (iOS keyboard rule).
    flushSync(() => actions.next());
    focusAnswer();
  }

  // In the header, in normal flow (never fixed, iOS keyboard). Saves the typed draft first, then leaves without grading.
  const header = (
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
  );

  if (phase.tag === 'study') {
    // Decision 33: look first. "Hazırım" hides the card and opens the question with the keyboard (same tap, iOS rule).
    return (
      <div className="screen card-screen">
        {header}
        <div className="screen__body">
          <RoundDots total={session.queue.length} cursor={session.cursor} reaskAt={reaskAt} label={t.roundProgress(session.cursor + 1, session.queue.length)} />
          <section className="question">
            {tag && (
              <p className="context-tag">
                <span className="visually-hidden">{t.contextPrefix} </span>
                {tag}
              </p>
            )}
            <p className="situation">{text}</p>
          </section>
          <StudyView item={item} boxBefore={state.progress.get(item.id)?.box ?? null} headingId={headingId} />
          <FlagButton flagged={state.flags.has(item.id)} onToggle={() => void actions.toggleFlag()} disabled={state.busy} />
          {state.error === 'save-failed' && (
            <p className="error" role="alert">
              {t.saveFailed}
            </p>
          )}
        </div>
        <div className="screen__footer">
          <button
            type="button"
            className="btn btn--primary"
            disabled={state.busy}
            onClick={() => {
              flushSync(() => actions.startWriting());
              focusAnswer();
            }}
          >
            {t.studyReady}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen card-screen">
      {header}
      <div className="screen__body">
        <RoundDots total={session.queue.length} cursor={session.cursor} reaskAt={reaskAt} label={t.roundProgress(session.cursor + 1, session.queue.length)} />
        <section className="question">
          <h2 id={headingId} className="label">
            {heading}
          </h2>
          {phase.tag === 'question' && mode === 'fix' && (
            <p id={mistakeId} className="fix-mistake" lang="en" data-testid="fix-mistake">
              {item.commonMistake}
            </p>
          )}
          {tag && (
            <p id={tagId} className="context-tag">
              <span className="visually-hidden">{t.contextPrefix} </span>
              {tag}
            </p>
          )}
          <p id={situationId} className="situation">
            {text}
          </p>
          {phase.tag === 'question' && session.hint !== undefined && mode !== 'order' && mode !== 'context' && entry.kind !== 'repeat' && <HintLine item={item} level={session.hint} />}
        </section>

        {phase.tag === 'question' && mode === 'order' ? (
          <WordOrder
            key={cardKey}
            tokens={orderTokens}
            disabled={state.busy}
            labelledBy={headingId}
            // The sentence only counts once every word is placed; it is not saved as a draft.
            onChange={(placed) => setDraft({ key: cardKey, text: placed.length === orderTokens.length ? placed.join(' ') : '' })}
          />
        ) : phase.tag === 'question' && context ? (
          <ContextBlanks
            key={cardKey}
            blanked={context.blanked}
            values={blankValues}
            onChange={(values) => onDraftChange(values.join('\n'))}
            onSubmit={submit}
            disabled={state.busy}
            labelledBy={headingId}
            describedBy={`${tag ? `${tagId} ` : ''}${situationId}`}
          />
        ) : phase.tag === 'question' ? (
          <AnswerInput
            ref={inputRef}
            placeholder={mode === 'fix' ? t.fixPlaceholder : undefined}
            value={draft.text}
            onChange={onDraftChange}
            onSubmit={submit}
            disabled={state.busy}
            labelledBy={headingId}
            describedBy={`${tag ? `${tagId} ` : ''}${situationId}${mode === 'fix' ? ` ${mistakeId}` : ''}`}
          />
        ) : (
          <ResultPanel
            ref={verdictRef}
            item={item} answer={phase.answer} original={phase.original} daily={phase.original !== undefined && phase.original === item.dailyContext?.sentence} matched={phase.matched} grade={phase.matched ? undefined : phase.grade} showNote={phase.mode === 'fix'} boxBefore={phase.boxBefore} hinted={phase.hinted === true} />
        )}

        {phase.tag === 'question' && mode !== 'order' && mode !== 'context' && entry.kind !== 'repeat' && (session.hint ?? 0) < 2 && (
          // Decision 35: hints on demand; the tap keeps the keyboard up.
          <button
            type="button"
            className="btn btn--text hint-button"
            disabled={state.busy}
            onClick={() => {
              flushSync(() => actions.showHint());
              focusAnswer();
            }}
          >
            {t.hintButton}
          </button>
        )}

        {phase.tag === 'question' && (
          // Keeps the typed draft: it is saved first, the sheet replaces the view, closing brings the card back (02, 03 H3.1).
          <button
            type="button"
            className="btn btn--text notebook-link"
            onClick={() => {
              persistDraft.flush();
              flushSync(() => actions.openNotebook('card'));
            }}
          >
            {t.notebookFromCard}
          </button>
        )}
        {/* Always in the DOM so the verdict is announced (08 #1); only the short verdict goes here. */}
        <p className="visually-hidden" role="status">
          {phase.tag === 'result' ? (phase.matched ? t.correct : t.notMatched) : ''}
        </p>

        <FlagButton
          flagged={state.flags.has(item.id)}
          onToggle={() => {
            // The flag records the typed answer: land the pending draft first (09 #6).
            persistDraft.flush();
            void actions.toggleFlag();
          }}
          disabled={state.busy}
        />

        {state.error === 'save-failed' && (
          <p className="error" role="alert">
            {t.saveFailed}
          </p>
        )}
      </div>

      <div className="screen__footer">
        {phase.tag === 'question' ? (
          <>
            <button type="button" className="btn btn--primary" onClick={submit} disabled={state.busy || !canCheck}>
              {t.check}
            </button>
            {mode !== 'order' && (
              // Decision 34: show the answer and count it wrong.
              <button
                type="button"
                className="btn btn--text dont-know"
                disabled={state.busy}
                onClick={() => {
                  persistDraft.cancel();
                  pendingFocus.current = 'next';
                  void actions.dontKnow(draft.text);
                }}
              >
                {t.dontKnow}
              </button>
            )}
          </>
        ) : !phase.matched && !phase.grade ? (
          // No "Sonraki" until the user grades an unmatched answer (T1.9).
          <GradeButtons
            onGrade={(g) => {
              pendingFocus.current = 'next';
              void actions.selfGrade(g);
            }}
            disabled={state.busy}
          />
        ) : (
          <>
            {session.undo && (
              <UndoBar key={session.undo.logId} expiresAt={session.undo.expiresAt} now={actions.now} onUndo={() => {
                  pendingFocus.current = 'verdict';
                  void actions.undo();
                }} disabled={state.busy} />
            )}
            <button ref={nextRef} type="button" className="btn btn--primary" onClick={next} disabled={state.busy}>
              {t.next}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
