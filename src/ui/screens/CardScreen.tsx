import { useEffect, useId, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type { Actions } from '../../app/actions.ts';
import type { ReadyState } from '../../app/state.ts';
import { hintStageFor } from '../../domain/hints.ts';
import { currentEntry } from '../../domain/session.ts';
import { AnswerInput } from '../components/AnswerInput.tsx';
import { FlagButton } from '../components/FlagButton.tsx';
import { GradeButtons } from '../components/GradeButtons.tsx';
import { HintLine } from '../components/HintLine.tsx';
import { useDebouncedCallback } from '../hooks/useDebouncedCallback.ts';
import { useVisualViewportHeight } from '../hooks/useVisualViewportHeight.ts';
import { ResultPanel } from '../components/ResultPanel.tsx';
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

  if (!session || !item) return null;
  const phase = session.phase;
  const { tag, text } = splitSituation(item.situationTr);

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
    inputRef.current?.focus();
  }

  return (
    <div className="screen card-screen">
      <div className="screen__body">
        <RoundDots total={session.queue.length} cursor={session.cursor} label={t.roundProgress(session.cursor + 1, session.queue.length)} />
        <section className="question">
          <h2 id={headingId} className="label">
            {item.source === 'user-error' ? t.userErrorHeading : t.questionHeading}
          </h2>
          {tag && (
            <p id={tagId} className="context-tag">
              <span className="visually-hidden">{t.contextPrefix} </span>
              {tag}
            </p>
          )}
          <p id={situationId} className="situation">
            {text}
          </p>
          {phase.tag === 'question' && <HintLine item={item} stage={hintStageFor(state.progress.get(item.id) ?? null)} />}
        </section>

        {phase.tag === 'question' ? (
          <AnswerInput
            ref={inputRef}
            value={draft.text}
            onChange={onDraftChange}
            onSubmit={submit}
            disabled={state.busy}
            labelledBy={headingId}
            describedBy={tag ? `${tagId} ${situationId}` : situationId}
          />
        ) : (
          <ResultPanel
            ref={verdictRef}
            item={item} answer={phase.answer} matched={phase.matched} grade={phase.matched ? undefined : phase.grade} />
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
          <button type="button" className="btn btn--primary" onClick={submit} disabled={state.busy || draft.text.trim() === ''}>
            {t.check}
          </button>
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
