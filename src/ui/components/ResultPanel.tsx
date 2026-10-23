import { forwardRef } from 'react';
import type { Grade, Item } from '../../domain/types.ts';
import { useOverlay } from '../../app/overlay.tsx';
import { topicForItem } from '../../content/extras.ts';
import { t } from '../strings.tr.ts';
import { gradeLabel } from './GradeButtons.tsx';
import { PatternCard } from './PatternCard.tsx';

interface Props {
  item: Item;
  answer: string;
  /** Decision 42: the full sentence of a fill-in-the-blanks card; shown as the correct answer. */
  original?: string | undefined;
  /** Decision 44b: the full sentence is the item's daily-life one; gets a small label. */
  daily?: boolean | undefined;
  matched: boolean;
  /** Self-grade once chosen (unmatched answers only). */
  grade?: Grade | undefined;
  /** Decision 37: after a "fix" answer the note is shown right away, also on a match. */
  showNote?: boolean;
  /** Box before this showing (null = new): commonMistake hidden at box ≤ 2 (decision 33). */
  boxBefore?: number | null | undefined;
  /** Decision 35: a correct answer that counted as partial because a hint was used. */
  hinted?: boolean;
}

/** The verdict heading takes focus after submit (ref; a11y audit 08 #2). */
export const ResultPanel = forwardRef<HTMLHeadingElement, Props>(function ResultPanel({ item, answer, original, daily, matched, grade, showNote, boxBefore, hinted }, verdictRef) {
  const canonical = item.acceptedAnswers[0] ?? '';
  const { open } = useOverlay();
  const topic = topicForItem(item.id);
  const others = item.modelSentences.filter((s) => s !== canonical);
  return (
    <section className="result">
      {matched ? (
        <h2 ref={verdictRef} tabIndex={-1} className="verdict verdict--ok">
          <span aria-hidden="true">✓</span> {t.correct}
        </h2>
      ) : (
        <h2 ref={verdictRef} tabIndex={-1} className="verdict verdict--miss">
          <span aria-hidden="true">≠</span> {t.notMatched}
        </h2>
      )}

      {hinted && (
        <p className="graded hint-credit" role="status" data-testid="hint-credit">
          {t.correctWithHint}
        </p>
      )}

      {daily && (
        <p className="context-tag" data-testid="daily-label">
          {t.dailyContext}
        </p>
      )}

      <dl className="answers">
        <div>
          <dt>{t.yourAnswer}</dt>
          <dd lang="en" className="answers__mine">{answer === '' ? t.noAnswer : answer}</dd>
        </div>
        {!matched && (
          <div>
            <dt>{t.correctAnswer}</dt>
            <dd lang="en" className="answers__canonical">{original ?? canonical}</dd>
          </div>
        )}
      </dl>

      {!matched && (
        <div className="block">
          <h2 className="label">{t.checklist}</h2>
          <ul className="checklist">
            {item.checklistTr.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      )}

      {!matched && grade && (
        <p className="graded" role="status">
          {t.gradedAs(gradeLabel(grade))}
        </p>
      )}

      {matched && (
        <div className="block">
          <h2 className="label">{t.modelSentences}</h2>
          <ul className="sentences" lang="en">
            {[canonical, ...others].map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      {showNote && matched && (
        <p className="pattern-card__note" data-testid="fix-note">
          {item.noteTr}
        </p>
      )}

      <PatternCard key={`${item.id}:${String(matched)}`} item={item} defaultOpen={!matched} showSentences={!matched} showMistake={(boxBefore ?? 1) >= 3} />

      {topic && (
        <button type="button" className="btn btn--text topic-link" data-testid="topic-link" onClick={(e) => {
            e.currentTarget.focus(); // Safari does not focus a clicked button; the overlay returns focus to it
            open({ kind: 'topic', topicId: topic.id });
          }}>
          {t.topicLesson}
        </button>
      )}
    </section>
  );
});
