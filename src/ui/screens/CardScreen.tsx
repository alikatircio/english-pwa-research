import { useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type { Actions } from '../../app/actions.ts';
import type { ReadyState } from '../../app/state.ts';
import { currentEntry } from '../../domain/session.ts';
import { AnswerInput } from '../components/AnswerInput.tsx';
import { GradeButtons } from '../components/GradeButtons.tsx';
import { ResultPanel } from '../components/ResultPanel.tsx';
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
  // Draft lives locally while typing; keyed per card so it resets on "Sonraki".
  const cardKey = `${session?.cursor ?? 0}:${entry?.itemId ?? ''}`;
  const [draft, setDraft] = useState({ key: cardKey, text: session?.draft ?? '' });
  if (draft.key !== cardKey) setDraft({ key: cardKey, text: session?.draft ?? '' });

  if (!session || !item) return null;
  const phase = session.phase;
  const { tag, text } = splitSituation(item.situationTr);

  function submit() {
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
        <section className="question">
          <p className="label">{t.questionHeading}</p>
          {tag && <p className="context-tag">{tag}</p>}
          <p className="situation">{text}</p>
        </section>

        {phase.tag === 'question' ? (
          <AnswerInput ref={inputRef} value={draft.text} onChange={(v) => setDraft({ key: cardKey, text: v })} onSubmit={submit} disabled={state.busy} />
        ) : (
          <ResultPanel item={item} answer={phase.answer} matched={phase.matched} grade={phase.matched ? undefined : phase.grade} />
        )}

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
          <GradeButtons onGrade={(g) => void actions.selfGrade(g)} disabled={state.busy} />
        ) : (
          <button type="button" className="btn btn--primary" onClick={next} disabled={state.busy}>
            {t.next}
          </button>
        )}
      </div>
    </div>
  );
}
